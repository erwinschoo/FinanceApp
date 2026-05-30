import { db } from "./schema";
import { toCents } from "../lib/money";
import { uid } from "../lib/id";
import { payeeKey, type PayeeRef } from "../helpers/payees";
import type { Category, CategoryType, GoalRow, ParsedRow, RuleRow, TxRow } from "./types";

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

/* ── Categorie-beheer ── */
const TINTS = ["var(--blue-soft)", "var(--orange-soft)", "#F2EFF7", "#ECF3F1", "#EBF1F2", "#F7EEF1", "#FAF1E6", "#F1F2F4", "#EAF3F4"];

export async function addCategory(c: { name: string; color: string; type: CategoryType; parentId: string | null }): Promise<string> {
  const id = uid("c");
  const row: Category = {
    id,
    name: c.name.trim() || "Naamloos",
    color: c.color,
    tint: TINTS[Math.floor(Math.random() * TINTS.length)],
    initial: (c.name.trim()[0] || "?").toUpperCase(),
    type: c.type,
    parentId: c.parentId,
  };
  await db.categories.put(row);
  return id;
}

export async function updateCategory(id: string, patch: Partial<Pick<Category, "name" | "color" | "type" | "parentId">>): Promise<void> {
  const clean: Partial<Category> = { ...patch };
  if (patch.name != null) clean.initial = (patch.name.trim()[0] || "?").toUpperCase();
  await db.categories.update(id, clean);
}

/* Hoeveel transacties gebruiken deze categorie (voor veilig verwijderen). */
export async function categoryUsage(id: string): Promise<{ txCount: number; childCount: number }> {
  const txCount = await db.transactions.where("category").equals(id).count();
  const childCount = await db.categories.where("parentId").equals(id).count();
  return { txCount, childCount };
}

/* Verwijder een categorie. Transacties + payee-mappings die ernaar wijzen worden
 * naar 'reassignTo' verplaatst (default 'overig'). Groepen met kinderen kunnen niet
 * worden verwijderd zolang er kinderen zijn. */
export async function deleteCategory(id: string, reassignTo = "overig"): Promise<void> {
  const childCount = await db.categories.where("parentId").equals(id).count();
  if (childCount > 0) throw new Error("Verplaats of verwijder eerst de subcategorieën.");
  await db.transaction("rw", db.categories, db.transactions, db.payees, async () => {
    const txs = await db.transactions.where("category").equals(id).toArray();
    if (txs.length) await db.transactions.bulkPut(txs.map((t) => ({ ...t, category: reassignTo })));
    const payees = await db.payees.where("categoryId").equals(id).toArray();
    if (payees.length) await db.payees.bulkPut(payees.map((p) => ({ ...p, categoryId: reassignTo })));
    await db.categories.delete(id);
  });
}

/* ── Regel-beheer ── */
export async function addRule(r: Omit<RuleRow, "id">): Promise<void> {
  await db.rules.put({ ...r, id: uid("r") });
}
export async function updateRule(id: string, patch: Partial<Omit<RuleRow, "id">>): Promise<void> {
  await db.rules.update(id, patch);
}
export async function deleteRule(id: string): Promise<void> {
  await db.rules.delete(id);
}
