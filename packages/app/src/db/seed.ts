import { db } from "./schema";
import { DEFAULT_CATEGORIES, DEFAULT_GROUPS } from "../categories";
import { DEFAULT_RULES } from "../categorize/rules";
import { uid } from "../lib/id";
import type { ImportProfileRow } from "./types";

const ING_PROFILE: ImportProfileRow = {
  id: "ing",
  bankName: "ING",
  columnMap: {
    date: "Date",
    name: "Name / Description",
    account: "Account",
    counterAccount: "Counterparty",
    debitCredit: "Debit/credit",
    amount: "Amount (EUR)",
    memo: "Notifications",
  },
  dateFormat: "yyyyMMdd",
  decimalSep: ",",
};

/* Seed alleen functionele referentie-structuur bij een lege database (eerste start):
 * categorieën, groepen, categorisatie-regels en het ING-importprofiel. Bewust GEEN
 * verzonnen cijfers (geen budgetbedragen, geen startsaldo, geen demo-transacties) —
 * alles wat op echte data lijkt start leeg, zodat een verse install nooit misleidt. */
export async function seedIfEmpty(): Promise<void> {
  const count = await db.categories.count();
  if (count > 0) return;

  await db.transaction("rw", [db.categories, db.categoryGroups, db.rules, db.importProfiles, db.meta], async () => {
    await db.categoryGroups.bulkPut(DEFAULT_GROUPS);
    await db.categories.bulkPut(DEFAULT_CATEGORIES);
    await db.rules.bulkPut(DEFAULT_RULES.map((r) => ({ ...r, id: uid("r") })));
    await db.importProfiles.put(ING_PROFILE);
    await db.meta.put({ key: "seededAt", value: new Date().toISOString() });
  });
}
