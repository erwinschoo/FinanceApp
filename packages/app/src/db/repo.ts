import { db } from "./schema";
import { toCents } from "../lib/money";
import { uid } from "../lib/id";
import { payeeKey, type PayeeRef } from "../helpers/payees";
import type { GoalRow, ParsedRow, TxRow } from "./types";

/* Categorie van een transactie wijzigen (handmatig → auto:false). */
export async function updateTxCategory(id: string, category: string): Promise<void> {
  await db.transactions.update(id, { category, auto: false });
}

/* Ken een categorie toe aan een hele tegenpartij: bewaar de mapping én pas 'm
 * toe op ALLE bestaande transacties van die tegenpartij (overschrijven). */
export async function assignPayeeCategory(
  ref: PayeeRef & { name?: string },
  categoryId: string,
): Promise<number> {
  const key = payeeKey(ref);
  const kind = ref.counterIban ? "iban" : "merchant";
  let updated = 0;
  await db.transaction("rw", db.payees, db.transactions, async () => {
    await db.payees.put({
      key,
      kind,
      iban: ref.counterIban || "",
      name: ref.name || ref.merchant || ref.counterIban || "Onbekend",
      categoryId,
    });
    const matches =
      kind === "iban"
        ? await db.transactions.where("counterIban").equals(ref.counterIban).toArray()
        : (await db.transactions.where("merchant").equals(ref.merchant).toArray()).filter((t) => !t.counterIban);
    if (matches.length) {
      await db.transactions.bulkPut(matches.map((t) => ({ ...t, category: categoryId, auto: true })));
      updated = matches.length;
    }
  });
  return updated;
}

/* key → categoryId voor toepassing tijdens import. */
export async function existingPayeeMap(): Promise<Map<string, string>> {
  const all = await db.payees.toArray();
  return new Map(all.filter((p) => p.categoryId).map((p) => [p.key, p.categoryId]));
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
 * Duplicaten (op dedupeHash) worden overgeslagen, maar hun saldo wordt nog wel
 * bijgewerkt (backfill) zodat herimport oudere transacties van een saldo voorziet.
 * Retourneert het aantal toegevoegd. */
export async function commitImport(rows: ParsedRow[], filename: string): Promise<number> {
  const fresh = rows.filter((r) => !r.duplicate);
  const dups = rows.filter((r) => r.duplicate && r.balance != null);

  await db.transaction("rw", db.transactions, db.importBatches, async () => {
    if (fresh.length > 0) {
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
        balanceCents: r.balance != null ? toCents(r.balance) : undefined,
      }));
      await db.transactions.bulkPut(txs);
      await db.importBatches.put({ id: batchId, filename, importedAt: new Date().toISOString(), count: txs.length });
    }
    // backfill saldo op bestaande duplicaten zonder saldo
    for (const r of dups) {
      const existing = await db.transactions.where("dedupeHash").equals(r.dedupeHash).first();
      if (existing && existing.balanceCents == null) {
        await db.transactions.update(existing.id, { balanceCents: toCents(r.balance as number) });
      }
    }
  });
  return fresh.length;
}

/* Bestaande dedupe-hashes ophalen (voor duplicaatdetectie tijdens parsing). */
export async function existingHashes(): Promise<Set<string>> {
  const all = await db.transactions.toArray();
  return new Set(all.map((t) => t.dedupeHash));
}
