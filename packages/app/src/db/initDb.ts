import { FinanceDB, setDb, db } from "./schema";
import { getEncEnabled, keepGet, keepPut, hasVault } from "./keep";
import { deletePlaintextDb } from "./vault";

/* Kiest de IndexedDB-backend van de hoofd-db op basis van de versleutel-stand en
 * opent 'm. ALLEREERSTE stap in de bootstrap (vóór elke db-consumer).
 *  - versleuteling UIT → normale browser-IndexedDB (persistent plaintext, zoals altijd);
 *  - versleuteling AAN → in-memory IndexedDB (fake-indexeddb) zodat plaintext nooit op
 *    schijf komt; de persistente kopie is dan uitsluitend de versleutelde vault (keep).
 * Retourneert of we in versleutelde modus draaien. */
export async function initDb(): Promise<{ encrypted: boolean }> {
  const encrypted = await getEncEnabled();
  if (encrypted) {
    const { IDBFactory, IDBKeyRange } = await import("fake-indexeddb");
    setDb(new FinanceDB({ indexedDB: new IDBFactory(), IDBKeyRange }));
    await db.open();
    // Geen plaintext op schijf: ruim een eventueel achtergebleven persistente
    // hoofd-db op — maar alleen als er een geldige vault is (anders zou dat data
    // wissen bij een half-afgemaakte inschakeling).
    if (await hasVault()) await deletePlaintextDb();
  } else {
    setDb(new FinanceDB());
    await db.open();
  }
  return { encrypted };
}

/* Eenmalige verhuizing van de apparaat-/sync-/account-meta van de hoofd-db naar de
 * keep-store. Deze keys moeten persistent blijven, ook wanneer de hoofd-db in-memory
 * draait (at-rest). Idempotent: bestaat de key al in keep, dan niets doen. Draait
 * zinvol in de UIT-modus (waar de oude keys nog in db.meta staan); in de AAN-modus is
 * de hoofd-db in-memory/leeg en is dit een no-op. */
export async function migrateMetaToKeepOnce(): Promise<void> {
  const KEYS = ["account", "accountPhoto", "sync", "enc", "encDeviceKey"] as const;
  for (const k of KEYS) {
    if ((await keepGet(k)) !== undefined) continue; // keep is leidend; niet overschrijven
    const r = await db.meta.get(k);
    if (r?.value !== undefined) {
      await keepPut(k, r.value);
      await db.meta.delete(k); // stale dubbele bron opruimen
    }
  }
}
