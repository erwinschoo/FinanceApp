import { db } from "../db/schema";
import { getToken, getTokenSilent } from "./msal";
import { getRemoteMeta, downloadData, uploadData, downloadProfilePhoto } from "./graphClient";

const SCHEMA_VERSION = 1;

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
}

export async function exportAll(): Promise<Snapshot> {
  const [categories, categoryGroups, transactions, budgets, rules, goals, importBatches, importProfiles, pots, payees] = await Promise.all([
    db.categories.toArray(), db.categoryGroups.toArray(), db.transactions.toArray(), db.budgets.toArray(),
    db.rules.toArray(), db.goals.toArray(), db.importBatches.toArray(), db.importProfiles.toArray(), db.pots.toArray(), db.payees.toArray(),
  ]);
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    categories, categoryGroups, transactions, budgets, rules, goals, importBatches, importProfiles, pots, payees,
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

/* Upload de lokale dataset naar OneDrive (overschrijft remote). */
export async function pushToOneDrive(): Promise<void> {
  const token = await getToken();
  const snap = await exportAll();
  const meta = await uploadData(token, snap);
  await setSyncMeta({ lastSyncedAt: new Date().toISOString(), remoteEtag: meta.eTag });
}

/* Haal de dataset op uit OneDrive (overschrijft lokaal). */
export async function pullFromOneDrive(): Promise<boolean> {
  const token = await getToken();
  const data = (await downloadData(token)) as Snapshot | null;
  if (!data) return false;
  await importAll(data);
  const meta = await getRemoteMeta(token);
  await setSyncMeta({ lastSyncedAt: new Date().toISOString(), remoteEtag: meta?.eTag ?? "" });
  return true;
}

export type SyncOutcome =
  | { action: "pushed" }
  | { action: "pulled" }
  | { action: "conflict"; remoteModified: string };

/* Automatische sync: vergelijk remote wijzigingsdatum met onze laatste sync.
 * - geen remote bestand → push
 * - remote nieuwer dan onze laatste sync (ander apparaat) → pull
 * - anders → push */
export async function syncNow(): Promise<SyncOutcome> {
  const token = await getToken();
  const remote = await getRemoteMeta(token);
  const local = await getSyncMeta();

  if (!remote) {
    await pushToOneDrive();
    return { action: "pushed" };
  }
  if (local && remote.eTag !== local.remoteEtag && remote.lastModified > local.lastSyncedAt) {
    await pullFromOneDrive();
    return { action: "pulled" };
  }
  await pushToOneDrive();
  return { action: "pushed" };
}
