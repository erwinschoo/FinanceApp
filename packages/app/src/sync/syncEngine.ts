import { db } from "../db/schema";
import { hasUserContent } from "../db/userContent";
import { getToken, getTokenSilent } from "./msal";
import { getRemoteMeta, downloadData, uploadData, downloadProfilePhoto, backupRemote, listBackups, downloadBackup, RemoteChangedError, type BackupItem } from "./graphClient";
import { isEncEnvelope, type EncEnvelope } from "./crypto";
import { isUnlocked, isEncryptionEnabled, sealSnapshot, openEnvelope, adoptCloudSlots } from "./encSession";

const SCHEMA_VERSION = 1;

export { RemoteChangedError };

/* Gegooid wanneer de cloud-data versleuteld is maar de sleutel (DEK) nog niet in
 * deze sessie is ontgrendeld. De sync-laag vertaalt dit naar een "locked"-uitkomst
 * i.p.v. een harde fout, zodat de UI om ontgrendeling kan vragen. */
export class SyncLockedError extends Error {
  constructor() {
    super("Je cloud-data is versleuteld en op dit toestel vergrendeld. Ontgrendel eerst (wachtwoord of biometrie) bij Synchroniseren → Versleuteling.");
    this.name = "SyncLockedError";
  }
}

export interface Snapshot {
  schemaVersion: number;
  exportedAt: string;
  categories: unknown[];
  transactions: unknown[];
  budgets: unknown[];
  rules: unknown[];
  goals: unknown[];
  importBatches: unknown[];
  importProfiles: unknown[];
  pots?: unknown[];
  categoryGroups?: unknown[];
  payees?: unknown[];
  /* Huishoudprofiel (meta["profile"]). Apparaat-onafhankelijk, dus wél meegesynct —
   * in tegenstelling tot de overige meta-keys (account/foto/sync-state). */
  profile?: unknown;
}

export async function exportAll(): Promise<Snapshot> {
  const [categories, categoryGroups, transactions, budgets, rules, goals, importBatches, importProfiles, pots, payees, profileRow] = await Promise.all([
    db.categories.toArray(), db.categoryGroups.toArray(), db.transactions.toArray(), db.budgets.toArray(),
    db.rules.toArray(), db.goals.toArray(), db.importBatches.toArray(), db.importProfiles.toArray(), db.pots.toArray(), db.payees.toArray(),
    db.meta.get("profile"),
  ]);
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    categories, categoryGroups, transactions, budgets, rules, goals, importBatches, importProfiles, pots, payees,
    profile: profileRow?.value ?? null,
  };
}

export async function importAll(snap: Snapshot): Promise<void> {
  await db.transaction("rw", [db.categories, db.categoryGroups, db.transactions, db.budgets, db.rules, db.goals, db.importBatches, db.importProfiles, db.pots, db.payees], async () => {
    await Promise.all([
      db.categories.clear(), db.categoryGroups.clear(), db.transactions.clear(), db.budgets.clear(),
      db.rules.clear(), db.goals.clear(), db.importBatches.clear(), db.importProfiles.clear(), db.pots.clear(), db.payees.clear(),
    ]);
    await Promise.all([
      db.categories.bulkPut(snap.categories as never[]),
      db.categoryGroups.bulkPut((snap.categoryGroups ?? []) as never[]),
      db.transactions.bulkPut(snap.transactions as never[]),
      db.budgets.bulkPut(snap.budgets as never[]),
      db.rules.bulkPut(snap.rules as never[]),
      db.goals.bulkPut(snap.goals as never[]),
      db.importBatches.bulkPut(snap.importBatches as never[]),
      db.importProfiles.bulkPut(snap.importProfiles as never[]),
      db.pots.bulkPut((snap.pots ?? []) as never[]),
      db.payees.bulkPut((snap.payees ?? []) as never[]),
    ]);
  });
  // Huishoudprofiel buiten de data-transactie toepassen (meta-tabel). Alleen
  // overschrijven wanneer de snapshot een profiel meelevert; ontbreekt het veld
  // (oudere snapshot) → lokaal profiel ongemoeid laten.
  if (snap.profile !== undefined) {
    if (snap.profile === null) await db.meta.delete("profile");
    else await db.meta.put({ key: "profile", value: snap.profile });
  }
}

async function setSyncMeta(v: { lastSyncedAt: string; remoteEtag: string }) {
  await db.meta.put({ key: "sync", value: v });
}
export async function getSyncMeta(): Promise<{ lastSyncedAt: string; remoteEtag: string } | null> {
  const r = await db.meta.get("sync");
  return (r?.value as { lastSyncedAt: string; remoteEtag: string }) ?? null;
}

/* Haal de profielfoto van de ingelogde gebruiker op en cache 'm in db.meta ("accountPhoto").
 * Stil: gebruikt alleen een silent token en faalt geruisloos (geen popup, geen sync-fout). */
export async function refreshProfilePhoto(): Promise<void> {
  try {
    const token = await getTokenSilent();
    if (!token) return;
    const dataUrl = await downloadProfilePhoto(token);
    if (dataUrl) await db.meta.put({ key: "accountPhoto", value: { dataUrl } });
    else await db.meta.delete("accountPhoto");
  } catch { /* genegeerd */ }
}

/* Maak de te uploaden payload: een versleutelde envelope als encryptie aanstaat,
 * anders de platte snapshot (legacy). Gooit SyncLockedError als encryptie aanstaat
 * maar de sessie nog vergrendeld is. */
async function buildPayload(snap: Snapshot): Promise<Snapshot | EncEnvelope> {
  if (!(await isEncryptionEnabled())) return snap;
  if (!isUnlocked()) throw new SyncLockedError();
  return sealSnapshot(snap);
}

/* Download de cloud-data en geef altijd een leesbare Snapshot terug:
 * - versleutelde envelope → sloten lokaal adopteren, daarna ontsleutelen
 *   (SyncLockedError als de sessie nog vergrendeld is);
 * - legacy plaintext → ongewijzigd teruggeven (wordt bij de volgende push versleuteld). */
async function readRemote(token: string): Promise<Snapshot | null> {
  const raw = await downloadData(token);
  if (raw === null) return null;
  if (isEncEnvelope(raw)) {
    await adoptCloudSlots(raw.slots); // markeert encryptie lokaal als aan + cachet sloten
    if (!isUnlocked()) throw new SyncLockedError();
    return (await openEnvelope(raw)) as Snapshot;
  }
  return raw as Snapshot;
}

/* Upload de lokale dataset naar OneDrive (overschrijft remote).
 * Air-tight: maakt eerst een getimestampte backup van de huidige cloud-versie, en
 * schrijft met If-Match op de laatst bekende eTag (optimistic concurrency) zodat een
 * intussen door een ander toestel gewijzigde cloud niet stil wordt overschreven.
 * Een 412 → RemoteChangedError (afgevangen door syncNow als conflict). */
export async function pushToOneDrive(opts?: { expectedEtag?: string }): Promise<void> {
  const token = await getToken();
  const expected = opts?.expectedEtag !== undefined ? opts.expectedEtag : (await getSyncMeta())?.remoteEtag;
  await backupRemote(token); // kopie vóór overwrite (no-op als er nog geen cloudbestand is)
  const snap = await exportAll();
  const meta = await uploadData(token, await buildPayload(snap), expected || undefined);
  await setSyncMeta({ lastSyncedAt: new Date().toISOString(), remoteEtag: meta.eTag });
}

/* Aantal transacties in een snapshot (de zwaarste, onvervangbare data). */
export function snapshotTxCount(snap: Snapshot): number {
  return Array.isArray(snap.transactions) ? snap.transactions.length : 0;
}

/* "Substantieel verlies": de vervangende dataset heeft fors minder transacties dan
 * wat er nu staat. Triggert bij meer dan 10 transacties én ≥10% minder, of wanneer
 * je álles (→ 0) zou wissen. Een klein/normaal multi-device-verschil triggert dus niet. */
export function isSubstantialTxLoss(haveTx: number, wouldHaveTx: number): boolean {
  if (haveTx <= 0) return false;
  if (wouldHaveTx <= 0) return true;
  const lost = haveTx - wouldHaveTx;
  return lost > 10 && lost >= haveTx * 0.1;
}

export interface RemoteSnapshot {
  snap: Snapshot;
  remoteTx: number; // transacties in de cloud-versie
  localTx: number;  // transacties op dit toestel
  remoteEtag: string;
}

/* Download de cloud-snapshot zonder iets toe te passen — voor een veiligheidscheck
 * vooraf, zodat we de aantallen kunnen vergelijken vóór we lokaal of de cloud overschrijven. */
export async function fetchRemoteSnapshot(): Promise<RemoteSnapshot | null> {
  const token = await getToken();
  const snap = await readRemote(token);
  if (!snap) return null;
  const meta = await getRemoteMeta(token);
  return { snap, remoteTx: snapshotTxCount(snap), localTx: await db.transactions.count(), remoteEtag: meta?.eTag ?? "" };
}

/* ── Lokale momentopnames (ring van laatste N) — vangnet vóór elke destructieve
 * lokale vervanging (pull/herstel), zodat een verkeerde overschrijving terug kan. */
const LOCAL_BACKUPS_KEY = "localBackups";
const LOCAL_BACKUP_KEEP = 3;

export interface LocalBackup {
  at: string;      // ISO
  txCount: number;
  snap: Snapshot;
}

export async function listLocalBackups(): Promise<LocalBackup[]> {
  const row = await db.meta.get(LOCAL_BACKUPS_KEY);
  return (row?.value as LocalBackup[] | undefined) ?? [];
}

async function snapshotLocal(): Promise<void> {
  const snap = await exportAll();
  const entry: LocalBackup = { at: new Date().toISOString(), txCount: snapshotTxCount(snap), snap };
  const next = [entry, ...(await listLocalBackups())].slice(0, LOCAL_BACKUP_KEEP);
  await db.meta.put({ key: LOCAL_BACKUPS_KEY, value: next });
}

/* Pas een opgehaalde snapshot toe als 'pull' (vervangt lokaal + zet de sync-baseline).
 * Maakt eerst een lokale momentopname (best-effort; mag de pull niet blokkeren). */
export async function applyPull(snap: Snapshot, remoteEtag: string): Promise<void> {
  try { await snapshotLocal(); } catch { /* vangnet; blokkeert de pull niet */ }
  await importAll(snap);
  await setSyncMeta({ lastSyncedAt: new Date().toISOString(), remoteEtag });
}

/* Zet een eerdere lokale momentopname terug (vervangt lokaal). Bewaart eerst de
 * huidige staat als nieuwe momentopname. Schrijft NIET naar de cloud; de gebruiker
 * uploadt daarna desgewenst bewust. */
export async function restoreLocalBackup(at: string): Promise<void> {
  const b = (await listLocalBackups()).find((x) => x.at === at);
  if (!b) throw new Error("Lokale back-up niet gevonden.");
  await snapshotLocal();
  await importAll(b.snap);
}

/* ── Cloud-backups (approot/backups) ── */
export async function fetchCloudBackups(): Promise<BackupItem[]> {
  return listBackups(await getToken());
}

/* Zet een cloud-backup terug naar lokaal (vervangt lokaal; ontsleutelt indien nodig).
 * Bewaart eerst de huidige lokale staat. Schrijft NIET naar de cloud. */
export async function restoreCloudBackup(name: string): Promise<void> {
  const token = await getToken();
  const raw = await downloadBackup(token, name);
  if (raw === null) throw new Error("Cloud-back-up niet gevonden.");
  let snap: Snapshot;
  if (isEncEnvelope(raw)) {
    await adoptCloudSlots(raw.slots);
    if (!isUnlocked()) throw new SyncLockedError();
    snap = (await openEnvelope(raw)) as Snapshot;
  } else {
    snap = raw as Snapshot;
  }
  await snapshotLocal();
  await importAll(snap);
}

export type SyncOutcome =
  | { action: "pushed" }
  | { action: "pulled" }
  | { action: "conflict"; remoteModified: string }
  | { action: "locked" }
  | { action: "noop" }; // niets te doen (bv. vers/leeg toestel zonder cloudbestand)

/* Automatische sync: vergelijk remote wijzigingsdatum met onze laatste sync.
 * - geen remote bestand → push (eerste upload ooit)
 * - geen lokale sync-baseline (nog nooit verzoend) + cloud heeft al data:
 *     · lokaal leeg → pull (niets te verliezen, adopteer de cloud)
 *     · lokaal gevuld → conflict (laat de gebruiker bewust kiezen)
 * - remote nieuwer (ander apparaat) → pull, behalve als dat substantieel
 *     transactie-verlies zou geven → dan conflict (niet stil overschrijven)
 * - anders → push */
export async function syncNow(): Promise<SyncOutcome> {
  try {
    return await syncNowInner();
  } catch (e) {
    if (e instanceof SyncLockedError) return { action: "locked" };
    // Cloud is intussen gewijzigd (If-Match 412): geen stille overschrijving, conflict.
    if (e instanceof RemoteChangedError) return { action: "conflict", remoteModified: "" };
    throw e;
  }
}

async function syncNowInner(): Promise<SyncOutcome> {
  const token = await getToken();
  const remote = await getRemoteMeta(token);
  const local = await getSyncMeta();

  if (!remote) {
    // Eerste upload ooit — maar NOOIT een vers/leeg toestel als "waarheid" wegschrijven.
    if (!(await hasUserContent())) return { action: "noop" };
    await pushToOneDrive();
    return { action: "pushed" };
  }
  if (!local) {
    // Nog nooit verzoend op dit toestel én er staat al data in de cloud. Heeft dit
    // toestel echte gebruikersdata → bewust laten kiezen (conflict). Anders (vers/
    // seed-only) de cloud adopteren via pull — nooit de cloud overschrijven.
    if (await hasUserContent()) {
      return { action: "conflict", remoteModified: remote.lastModified };
    }
    const snap = await readRemote(token);
    if (snap) await applyPull(snap, remote.eTag);
    return { action: "pulled" };
  }
  if (remote.eTag !== local.remoteEtag && remote.lastModified > local.lastSyncedAt) {
    const snap = await readRemote(token);
    if (!snap) { await pushToOneDrive(); return { action: "pushed" }; }
    if (isSubstantialTxLoss(await db.transactions.count(), snapshotTxCount(snap))) {
      return { action: "conflict", remoteModified: remote.lastModified };
    }
    await applyPull(snap, remote.eTag);
    return { action: "pulled" };
  }
  await pushToOneDrive();
  return { action: "pushed" };
}
