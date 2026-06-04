import { db, type FinanceDB } from "./schema";

/* Pure snapshot-laag: zet alle data-tabellen om naar één serialiseerbaar object en
 * terug. Bewust MSAL-/crypto-vrij, zodat zowel de cloud-sync (syncEngine) als de
 * lokale at-rest-vault (db/vault.ts) dit kunnen hergebruiken zonder de MSAL-bundle
 * in de hoofdchunk te trekken. */

export const SCHEMA_VERSION = 1;

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

/* `target` laat een alternatieve db-instantie kiezen (bv. een verse persistente db
 * bij het uitschakelen van at-rest-versleuteling); standaard de actieve hoofd-db. */
export async function importAll(snap: Snapshot, target: FinanceDB = db): Promise<void> {
  await target.transaction("rw", [target.categories, target.categoryGroups, target.transactions, target.budgets, target.rules, target.goals, target.importBatches, target.importProfiles, target.pots, target.payees], async () => {
    await Promise.all([
      target.categories.clear(), target.categoryGroups.clear(), target.transactions.clear(), target.budgets.clear(),
      target.rules.clear(), target.goals.clear(), target.importBatches.clear(), target.importProfiles.clear(), target.pots.clear(), target.payees.clear(),
    ]);
    await Promise.all([
      target.categories.bulkPut(snap.categories as never[]),
      target.categoryGroups.bulkPut((snap.categoryGroups ?? []) as never[]),
      target.transactions.bulkPut(snap.transactions as never[]),
      target.budgets.bulkPut(snap.budgets as never[]),
      target.rules.bulkPut(snap.rules as never[]),
      target.goals.bulkPut(snap.goals as never[]),
      target.importBatches.bulkPut(snap.importBatches as never[]),
      target.importProfiles.bulkPut(snap.importProfiles as never[]),
      target.pots.bulkPut((snap.pots ?? []) as never[]),
      target.payees.bulkPut((snap.payees ?? []) as never[]),
    ]);
  });
  // Huishoudprofiel buiten de data-transactie toepassen (meta-tabel). Alleen
  // overschrijven wanneer de snapshot een profiel meelevert; ontbreekt het veld
  // (oudere snapshot) → lokaal profiel ongemoeid laten.
  if (snap.profile !== undefined) {
    if (snap.profile === null) await target.meta.delete("profile");
    else await target.meta.put({ key: "profile", value: snap.profile });
  }
}

/* Aantal transacties in een snapshot (de zwaarste, onvervangbare data). */
export function snapshotTxCount(snap: Snapshot): number {
  return Array.isArray(snap.transactions) ? snap.transactions.length : 0;
}
