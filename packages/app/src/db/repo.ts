import { db } from "./schema";
import { toCents } from "../lib/money";
import { uid } from "../lib/id";
import { makeRule } from "../categorize/rules";
import type { GoalRow, ParsedRow, TxRow } from "./types";

/* Categorie van een transactie wijzigen (handmatig → auto:false). */
export async function updateTxCategory(id: string, category: string): Promise<void> {
  await db.transactions.update(id, { category, auto: false });
}

/* Een terugkerend budget per categorie zetten (euro's in). */
export async function setRecurringBudget(categoryId: string, euros: number): Promise<void> {
  await db.budgets.put({
    id: `${categoryId}:recurring`,
    categoryId,
    month: null,
    amountCents: toCents(euros),
    carryOver: false,
  });
}

/* Een regel afleiden uit een handmatige indeling en opslaan. */
export async function addRuleFromMerchant(merchant: string, categoryId: string): Promise<void> {
  const rule = makeRule("merchant", merchant, categoryId, 50);
  await db.rules.put(rule);
}

/* Spaardoel toevoegen of bijwerken (euro's in). */
export async function upsertGoal(g: {
  id?: string; name: string; target: number; current: number; monthly: number;
  startDate: string; targetDate: string; priority: number; color: string;
}): Promise<void> {
  const row: GoalRow = {
    id: g.id ?? uid("g"),
    name: g.name,
    targetCents: toCents(g.target),
    currentCents: toCents(g.current),
    monthlyCents: toCents(g.monthly),
    startDate: g.startDate,
    targetDate: g.targetDate,
    priority: g.priority,
    color: g.color,
  };
  await db.goals.put(row);
}

export async function deleteGoal(id: string): Promise<void> {
  await db.goals.delete(id);
}

/* Geïmporteerde rijen vastleggen: nieuwe transacties + een import-batch.
 * Duplicaten (op dedupeHash) worden overgeslagen. Retourneert het aantal toegevoegd. */
export async function commitImport(rows: ParsedRow[], filename: string): Promise<number> {
  const fresh = rows.filter((r) => !r.duplicate);
  if (fresh.length === 0) return 0;
  const batchId = uid("b");
  const txs: TxRow[] = fresh.map((r) => ({
    id: uid("t"),
    date: r.date,
    merchant: r.merchant,
    rawDescription: r.rawDescription,
    category: r.category,
    amountCents: toCents(r.amount),
    auto: r.category !== "",
    note: "",
    counterIban: r.counterIban,
    accountIban: r.accountIban,
    importBatchId: batchId,
    dedupeHash: r.dedupeHash,
  }));
  await db.transaction("rw", db.transactions, db.importBatches, async () => {
    await db.transactions.bulkPut(txs);
    await db.importBatches.put({
      id: batchId,
      filename,
      importedAt: new Date().toISOString(),
      count: txs.length,
    });
  });
  return txs.length;
}

/* Bestaande dedupe-hashes ophalen (voor duplicaatdetectie tijdens parsing). */
export async function existingHashes(): Promise<Set<string>> {
  const all = await db.transactions.toArray();
  return new Set(all.map((t) => t.dedupeHash));
}
