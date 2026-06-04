import Dexie from "dexie";
import { db, FinanceDB } from "./schema";
import { exportAll, importAll, type Snapshot } from "./snapshot";
import { writeVaultAtomic, readVaultChain, clearVault, hasVault } from "./keep";
import { sealSnapshot, openEnvelope, isUnlocked } from "../sync/encSession";
import type { EncEnvelope } from "../sync/crypto";

const MAIN_DB = "bokkiep";

/* At-rest-vault: wanneer versleuteling aanstaat draait de hoofd-db in-memory en is
 * de versleutelde vault (in de keep-store) de enige persistente kopie. We hergebruiken
 * de pure snapshot-laag (db/snapshot.ts) + de bestaande envelope-crypto (encSession).
 * De vault dekt álle data-tabellen + de meta-keys die níet apparaat-globaal zijn. */

const VAULT_META_KEYS = ["userTouched", "seededAt", "localBackups"] as const;

export interface VaultSnapshot extends Snapshot {
  vaultMeta?: Record<string, unknown>;
}

/* Volledige dump: snapshot (data-tabellen + profiel) + de gevaulte meta-keys. */
export async function dumpAll(): Promise<VaultSnapshot> {
  const snap = await exportAll();
  const vaultMeta: Record<string, unknown> = {};
  for (const k of VAULT_META_KEYS) {
    const r = await db.meta.get(k);
    if (r?.value !== undefined) vaultMeta[k] = r.value;
  }
  return { ...snap, vaultMeta };
}

/* Volledig herstel in een db-instantie (standaard de actieve hoofd-db). */
export async function restoreAll(snap: VaultSnapshot, target: FinanceDB = db): Promise<void> {
  await importAll(snap, target); // data-tabellen + profiel
  if (snap.vaultMeta) {
    for (const [k, v] of Object.entries(snap.vaultMeta)) {
      await target.meta.put({ key: k, value: v });
    }
  }
}

/* Verwijder de plaintext-hoofd-db van schijf (de echte browser-IndexedDB) — gebruikt
 * bij at-rest, waar de in-memory db op een eigen factory draait. Dexie.delete gebruikt
 * de globale indexedDB, dus dit raakt nooit de in-memory instantie. */
export async function deletePlaintextDb(): Promise<void> {
  await Dexie.delete(MAIN_DB);
}

/* Uitschakelen van at-rest: schrijf de huidige (ontsleutelde, in-memory) data naar een
 * verse PERSISTENTE plaintext-db, met tel-verificatie. Wist daarna pas de versleuteling.
 * De aanroeper herlaadt hierna (initDb opent dan de persistente db in normale modus). */
export async function exportToPlaintextDb(): Promise<void> {
  const dump = await dumpAll();
  await Dexie.delete(MAIN_DB);            // schoon beginnen op de globale backend
  const plain = new FinanceDB();          // globale (browser) backend, naam "bokkiep"
  await plain.open();
  await restoreAll(dump, plain);
  const expected = Array.isArray(dump.transactions) ? dump.transactions.length : 0;
  const got = await plain.transactions.count();
  plain.close();
  if (got !== expected) throw new Error("Verificatie mislukt bij het uitschakelen — geen wijziging doorgevoerd.");
}

export { clearVault, hasVault };

/* ── Hydrate-status (geldt bij at-rest: app pas tonen ná hydrate) ── */
let hydrated = false;
const listeners = new Set<() => void>();
export function isHydrated(): boolean { return hydrated; }
export function subscribeHydrated(cb: () => void): () => void { listeners.add(cb); return () => listeners.delete(cb); }
function markHydrated() { hydrated = true; for (const l of listeners) l(); }

function isValidSnapshot(s: unknown): s is VaultSnapshot {
  return !!s && typeof s === "object"
    && Array.isArray((s as VaultSnapshot).transactions)
    && Array.isArray((s as VaultSnapshot).categories);
}

/* Ontsleutel de vault en herstel hem in de hoofd-db. Vereist een ontgrendelde sessie
 * (DEK in geheugen). Probeert achtereenvolgens vault → vault_prev → vault_prev2 zodat
 * een corrupte nieuwste versie niet fataal is. Lege keten (nog geen vault) = geldige,
 * lege start. */
export async function hydrateFromVault(): Promise<void> {
  if (!isUnlocked()) throw new Error("Niet ontgrendeld.");
  const chain = await readVaultChain();
  if (chain.length === 0) { markHydrated(); return; }
  let lastErr: unknown;
  for (const env of chain) {
    try {
      const snap = await openEnvelope(env as EncEnvelope);
      if (!isValidSnapshot(snap)) throw new Error("Ongeldige vault-inhoud.");
      await restoreAll(snap);
      markHydrated();
      return;
    } catch (e) { lastErr = e; }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Kon de vault niet ontsleutelen.");
}

/* Verifieer dat de geschreven vault terug-ontsleutelt en geldig is (zonder te herstellen).
 * Gebruikt bij het inschakelen, vóór we de plaintext-db van schijf verwijderen. */
export async function verifyVault(): Promise<boolean> {
  if (!isUnlocked()) return false;
  const chain = await readVaultChain();
  if (chain.length === 0) return false;
  try {
    return isValidSnapshot(await openEnvelope(chain[0] as EncEnvelope));
  } catch {
    return false;
  }
}

/* Schrijf de huidige in-memory data versleuteld naar de vault (atomic, met ring). */
export async function persistVaultNow(): Promise<void> {
  if (!isUnlocked()) return;
  const dump = await dumpAll();
  const env = await sealSnapshot(dump);
  await writeVaultAtomic(env);
}

/* Gedebouncete variant — aangeroepen na elke datamutatie (via scheduleSync). */
const DEBOUNCE_MS = 1000;
let timer: ReturnType<typeof setTimeout> | null = null;
export function schedulePersistVault(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void persistVaultNow(); }, DEBOUNCE_MS);
}
