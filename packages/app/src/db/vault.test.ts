import "fake-indexeddb/auto";
import { beforeAll, beforeEach, describe, it, expect } from "vitest";
import { initDb } from "./initDb";
import { db } from "./schema";
import { keep } from "./keep";
import { seedIfEmpty } from "./seed";
import { setupEncryption, lock, unlockWithPassphrase, isUnlocked } from "../sync/encSession";
import { persistVaultNow, hydrateFromVault, verifyVault } from "./vault";

/* Echte at-rest round-trip met échte crypto (geen mocks): seed + data → versleutelde
 * vault → "reload" (in-memory wissen + lock) → ontgrendelen + hydrate herstelt alles. */

beforeAll(async () => { await initDb(); });

async function clearAll() {
  await Promise.all([
    db.categories, db.categoryGroups, db.transactions, db.budgets, db.rules, db.goals,
    db.importBatches, db.importProfiles, db.pots, db.payees, db.meta,
  ].map((t) => t.clear()));
  await keep.kv.clear();
  lock();
}
beforeEach(clearAll);

function tx(id: string) {
  return {
    id, date: "2026-01-01", merchant: "AH", rawDescription: "", category: "",
    amountCents: -1234, auto: false, note: "", counterIban: "", accountIban: "",
    importBatchId: "b", dedupeHash: id,
  };
}

describe("at-rest vault", () => {
  it("round-trip herstelt data + gevaulte meta na een 'reload'", async () => {
    await seedIfEmpty();
    await db.transactions.put(tx("t1"));
    await db.meta.put({ key: "userTouched", value: true });
    const catCount = await db.categories.count();

    await setupEncryption("wachtwoord123"); // DEK in geheugen
    await persistVaultNow();
    expect(await verifyVault()).toBe(true);

    // simuleer reload: in-memory tabellen leeg + sessie vergrendeld
    await Promise.all([db.categories, db.transactions, db.meta].map((t) => t.clear()));
    lock();
    expect(isUnlocked()).toBe(false);

    await unlockWithPassphrase("wachtwoord123");
    await hydrateFromVault();

    expect(await db.transactions.count()).toBe(1);
    expect(await db.categories.count()).toBe(catCount);
    expect((await db.meta.get("userTouched"))?.value).toBe(true);
  });

  it("verkeerd wachtwoord ontgrendelt niet", async () => {
    await seedIfEmpty();
    await setupEncryption("goedwachtwoord");
    await persistVaultNow();
    lock();
    await expect(unlockWithPassphrase("foutwachtwoord")).rejects.toBeTruthy();
  });

  it("verifyVault is false zonder vault", async () => {
    await setupEncryption("pw12345678");
    expect(await verifyVault()).toBe(false); // nog niets geschreven
  });
});
