import { db } from "./schema";
import { DEFAULT_CATEGORIES } from "../categories";
import { DEFAULT_RULES } from "../categorize/rules";
import { toCents } from "../lib/money";
import { uid } from "../lib/id";
import type { BudgetRow, ImportProfileRow } from "./types";

/* Handige standaardbudgetten per categorie (euro/maand) — bewerkbaar in de app. */
const DEFAULT_BUDGETS: Record<string, number> = {
  boodschappen: 520, wonen: 1400, vervoer: 180, abonnementen: 140,
  gezondheid: 90, vrijetijd: 320, verzekeringen: 230, overig: 80,
};

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

/* Seed alleen referentiedata bij een lege database (eerste start).
 * GEEN demo-transacties of -doelen: de app start schoon en jouw import is de basis. */
export async function seedIfEmpty(): Promise<void> {
  const count = await db.categories.count();
  if (count > 0) return;

  await db.transaction("rw", [db.categories, db.budgets, db.rules, db.importProfiles, db.meta], async () => {
    await db.categories.bulkPut(DEFAULT_CATEGORIES);
    await db.rules.bulkPut(DEFAULT_RULES.map((r) => ({ ...r, id: uid("r") })));

    const budgets: BudgetRow[] = Object.entries(DEFAULT_BUDGETS).map(([categoryId, euros]) => ({
      id: `${categoryId}:recurring`,
      categoryId,
      month: null,
      amountCents: toCents(euros),
      carryOver: false,
    }));
    await db.budgets.bulkPut(budgets);

    await db.importProfiles.put(ING_PROFILE);
    await db.meta.put({ key: "seededAt", value: new Date().toISOString() });
  });
}
