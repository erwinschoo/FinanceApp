import { FinanceDB, setDb, db } from "./schema";
import { keepGet, keepPut, hasVault } from "./keep";
import { deletePlaintextDb } from "./vault";

/* Kiest de IndexedDB-backend van de hoofd-db en opent 'm. ALLEREERSTE stap in de
 * bootstrap (vóór elke db-consumer).
 *  - At-rest draait pas écht wanneer er versleuteling is ingesteld (enc-slot in de
 *    keep-store) én er een versleutelde vault bestaat → in-memory IndexedDB
 *    (fake-indexeddb), zodat plaintext nooit op schijf komt.
 *  - Anders de normale browser-IndexedDB (persistent). Dit dekt ook een nog-niet-
 *    gemigreerde gebruiker die al wél versleuteling had (cloud-only): die draait nog
 *    persistent en migreert na de eerste ontgrendeling naar de vault.
 * Retourneert of we at-rest (in-memory) draaien. */
export async function initDb(): Promise<{ atRest: boolean }> {
  const atRest = (await hasVault()) && (await keepGet("enc")) != null;
  if (atRest) {
    const { IDBFactory, IDBKeyRange } = await import("fake-indexeddb");
    setDb(new FinanceDB({ indexedDB: new IDBFactory(), IDBKeyRange }));
    await db.open();
    await deletePlaintextDb(); // geen plaintext op schijf laten staan
  } else {
    setDb(new FinanceDB());
    await db.open();
  }
  return { atRest };
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
