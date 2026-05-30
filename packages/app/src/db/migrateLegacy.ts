import Dexie from "dexie";
import { db } from "./schema";

/* Eénmalige migratie van de oude "financeapp"-IndexedDB naar de nieuwe "bokkiep"-db
 * (naamswijziging bij de rebrand). Draait op dezelfde origin, dus de oude database is
 * gewoon bereikbaar. De oude db blijft als back-up bestaan (wordt NIET verwijderd).
 * Voor nieuwe/publieke gebruikers (geen oude db) is dit een no-op. */

const LEGACY = "financeapp";

// Alle datatabellen behalve "meta": account/sync-status laten we vers, omdat de
// OneDrive-koppeling (nieuwe Entra-registratie/folder) opnieuw wordt opgezet.
const DATA_TABLES = [
  "categories",
  "categoryGroups",
  "transactions",
  "budgets",
  "rules",
  "goals",
  "importBatches",
  "importProfiles",
  "pots",
  "payees",
] as const;

export async function migrateFromLegacyDb(): Promise<void> {
  try {
    // Al data in de nieuwe db? Dan niets te doen (al gemigreerd of nieuwe gebruiker met data).
    if ((await db.categories.count()) > 0) return;
    if (!(await Dexie.exists(LEGACY))) return;

    // Open de oude db read-only met de v5-store-definitie (de huidige/laatste vorm).
    const legacy = new Dexie(LEGACY);
    legacy.version(5).stores({
      categories: "id, groupId, type",
      categoryGroups: "id, order",
      transactions: "id, date, category, dedupeHash, importBatchId, counterIban, merchant",
      budgets: "id, categoryId, month",
      rules: "id, categoryId, priority",
      goals: "id, priority",
      importBatches: "id, importedAt",
      importProfiles: "id, bankName",
      payees: "key, categoryId, kind",
      pots: "categoryId",
      meta: "key",
    });
    await legacy.open();

    const data: Record<string, unknown[]> = {};
    for (const t of DATA_TABLES) {
      data[t] = await legacy.table(t).toArray();
    }

    const total = Object.values(data).reduce((n, rows) => n + rows.length, 0);
    if (total > 0) {
      await db.transaction("rw", db.tables, async () => {
        for (const t of DATA_TABLES) {
          if (data[t]?.length) await db.table(t).bulkPut(data[t] as never[]);
        }
      });
      await db.meta.put({ key: "migratedFrom", value: { db: LEGACY, at: new Date().toISOString(), records: total } });
    }

    legacy.close();
  } catch (e) {
    // Migratie mag de app-start nooit blokkeren; de oude db blijft als back-up bestaan.
    console.warn("[bokkiep] legacy-migratie overgeslagen:", e);
  }
}
