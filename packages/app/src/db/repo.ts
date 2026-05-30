import { db } from "./schema";
import { toCents } from "../lib/money";
import { uid } from "../lib/id";
import { payeeKey, type PayeeRef } from "../helpers/payees";
import { scheduleSync } from "../sync/autoSync";
import type { Category, CategoryGroupRow, CategoryType, GoalRow, ParsedRow, RuleRow, TxRow } from "./types";

/* Categorie van een transactie wijzigen (handmatig → auto:false). */
export async function updateTxCategory(id: string, category: string): Promise<void> {
  await db.transactions.update(id, { category, auto: false });
  scheduleSync();
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
  scheduleSync();
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
  scheduleSync();
}

/* ── Spaardoelen (per categorie geprioriteerd) ── */

async function goalsInCategory(categoryId: string): Promise<GoalRow[]> {
  const all = await db.goals.toArray();
  return all.filter((g) => g.categoryId === categoryId).sort((a, b) => a.priority - b.priority);
}

/* Voeg een doel toe aan een categorie (achteraan in de prioriteit). */
export async function addGoalToCategory(categoryId: string): Promise<void> {
  const cat = await db.categories.get(categoryId);
  const today = new Date();
  const targetDate = new Date(today.getFullYear() + 2, today.getMonth(), 1);
  await db.transaction("rw", db.goals, db.categories, async () => {
    const inCat = await goalsInCategory(categoryId);
    const priority = (inCat.at(-1)?.priority ?? 0) + 1;
    await db.goals.put({
      id: uid("g"), name: "Nieuw doel", categoryId,
      targetCents: toCents(5000), currentCents: 0, monthlyCents: 0,
      startDate: today.toISOString().slice(0, 10), targetDate: targetDate.toISOString().slice(0, 10),
      priority, color: cat?.color ?? "var(--blue)",
    });
  });
  scheduleSync();
}

/* Naam/doelbedrag van een doel bijwerken. */
export async function updateGoal(id: string, patch: { name?: string; target?: number }): Promise<void> {
  const p: Partial<GoalRow> = {};
  if (patch.name !== undefined) p.name = patch.name;
  if (patch.target !== undefined) p.targetCents = toCents(patch.target);
  await db.goals.update(id, p);
  scheduleSync();
}

/* Verwijder een doel en hernummer de prioriteiten binnen díe categorie naar 1…N. */
export async function deleteGoal(id: string): Promise<void> {
  await db.transaction("rw", db.goals, async () => {
    const goal = await db.goals.get(id);
    await db.goals.delete(id);
    if (goal) {
      const rest = await goalsInCategory(goal.categoryId);
      await db.goals.bulkPut(rest.map((g, i) => ({ ...g, priority: i + 1 })));
    }
  });
  scheduleSync();
}

/* Verschuif een doel binnen zijn categorie één plek omhoog/omlaag (prioriteit-swap met de buur). */
export async function moveGoalPriority(id: string, dir: "up" | "down"): Promise<void> {
  await db.transaction("rw", db.goals, async () => {
    const goal = await db.goals.get(id);
    if (!goal) return;
    const ordered = await goalsInCategory(goal.categoryId);
    const idx = ordered.findIndex((g) => g.id === id);
    const swapWith = dir === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapWith < 0 || swapWith >= ordered.length) return;
    const a = ordered[idx], b = ordered[swapWith];
    await db.goals.bulkPut([{ ...a, priority: b.priority }, { ...b, priority: a.priority }]);
  });
  scheduleSync();
}

/* ── Spaarpot per categorie (een categorie met pot = spaarcategorie in de ribbon) ── */
async function putPot(categoryId: string, patch: Partial<{ openingCents: number; monthlyCents: number; inverted: boolean }>): Promise<void> {
  const cur = await db.pots.get(categoryId);
  await db.pots.put({
    categoryId,
    openingCents: patch.openingCents ?? cur?.openingCents ?? 0,
    monthlyCents: patch.monthlyCents ?? cur?.monthlyCents ?? 0,
    inverted: patch.inverted ?? cur?.inverted ?? false,
  });
}

export async function setPotOpening(categoryId: string, euros: number): Promise<void> {
  await putPot(categoryId, { openingCents: toCents(euros) });
  scheduleSync();
}
export async function setPotMonthly(categoryId: string, euros: number): Promise<void> {
  await putPot(categoryId, { monthlyCents: toCents(euros) });
  scheduleSync();
}
export async function setPotInverted(categoryId: string, inverted: boolean): Promise<void> {
  await putPot(categoryId, { inverted });
  scheduleSync();
}

/* Voeg een bestaande categorie toe als spaarcategorie (pot + één startdoel). */
export async function addPotCategory(categoryId: string): Promise<void> {
  await db.pots.put({ categoryId, openingCents: 0, monthlyCents: toCents(100), inverted: false });
  await addGoalToCategory(categoryId);
}

/* Verwijder een spaarcategorie: de pot én alle doelen van die categorie. */
export async function removePotCategory(categoryId: string): Promise<void> {
  await db.transaction("rw", db.goals, db.pots, async () => {
    const ids = (await db.goals.toArray()).filter((g) => g.categoryId === categoryId).map((g) => g.id);
    await db.goals.bulkDelete(ids);
    await db.pots.delete(categoryId);
  });
  scheduleSync();
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
  scheduleSync();
  return fresh.length;
}

/* Bestaande dedupe-hashes ophalen (voor duplicaatdetectie tijdens parsing). */
export async function existingHashes(): Promise<Set<string>> {
  const all = await db.transactions.toArray();
  return new Set(all.map((t) => t.dedupeHash));
}

/* ── Categorie-beheer ── */
const TINTS = ["var(--blue-soft)", "var(--orange-soft)", "#F2EFF7", "#ECF3F1", "#EBF1F2", "#F7EEF1", "#FAF1E6", "#F1F2F4", "#EAF3F4"];

export async function addCategory(c: { name: string; color: string; type: CategoryType; groupId: string }): Promise<string> {
  const id = uid("c");
  const inGroup = (await db.categories.where("groupId").equals(c.groupId).toArray());
  const order = inGroup.reduce((m, x) => Math.max(m, x.order ?? 0), -1) + 1;
  const row: Category = {
    id,
    name: c.name.trim() || "Naamloos",
    color: c.color,
    tint: TINTS[Math.floor(Math.random() * TINTS.length)],
    initial: (c.name.trim()[0] || "?").toUpperCase(),
    type: c.type,
    groupId: c.groupId,
    order,
  };
  await db.categories.put(row);
  scheduleSync();
  return id;
}

export async function updateCategory(id: string, patch: Partial<Pick<Category, "name" | "color" | "type" | "groupId">>): Promise<void> {
  const clean: Partial<Category> = { ...patch };
  if (patch.name != null) clean.initial = (patch.name.trim()[0] || "?").toUpperCase();
  // bij wisselen van groep achteraan in de nieuwe groep plaatsen
  if (patch.groupId != null) {
    const inGroup = await db.categories.where("groupId").equals(patch.groupId).toArray();
    clean.order = inGroup.filter((x) => x.id !== id).reduce((m, x) => Math.max(m, x.order ?? 0), -1) + 1;
  }
  await db.categories.update(id, clean);
  scheduleSync();
}

/* Hoeveel transacties gebruiken deze categorie (voor veilig verwijderen). */
export async function categoryUsage(id: string): Promise<{ txCount: number }> {
  const txCount = await db.transactions.where("category").equals(id).count();
  return { txCount };
}

/* Verwijder een categorie. Transacties + payee-mappings die ernaar wijzen worden
 * naar 'reassignTo' verplaatst (default 'overig'). */
export async function deleteCategory(id: string, reassignTo = "overig"): Promise<void> {
  await db.transaction("rw", db.categories, db.transactions, db.payees, async () => {
    const txs = await db.transactions.where("category").equals(id).toArray();
    if (txs.length) await db.transactions.bulkPut(txs.map((t) => ({ ...t, category: reassignTo })));
    const payees = await db.payees.where("categoryId").equals(id).toArray();
    if (payees.length) await db.payees.bulkPut(payees.map((p) => ({ ...p, categoryId: reassignTo })));
    await db.categories.delete(id);
  });
  scheduleSync();
}

/* ── Categoriegroep-beheer (puur organisatorisch) ── */
const GROUP_COLORS = ["var(--blue)", "var(--orange)", "var(--pos)", "var(--cat-5)", "var(--cat-6)", "var(--cat-4)", "#7A6FA8", "#5AA0A8"];

export async function addCategoryGroup(g: { name: string; color?: string }): Promise<string> {
  const id = uid("grp");
  const all = await db.categoryGroups.toArray();
  const order = all.reduce((m, x) => Math.max(m, x.order ?? 0), -1) + 1;
  await db.categoryGroups.put({
    id,
    name: g.name.trim() || "Nieuwe groep",
    color: g.color ?? GROUP_COLORS[all.length % GROUP_COLORS.length],
    order,
  });
  scheduleSync();
  return id;
}

export async function updateCategoryGroup(id: string, patch: Partial<Pick<CategoryGroupRow, "name" | "color">>): Promise<void> {
  await db.categoryGroups.update(id, patch);
  scheduleSync();
}

/* Verwijder een groep. De categorieën erin verhuizen naar 'reassignTo' (verplicht:
 * een groep mag geen wezen achterlaten). */
export async function deleteCategoryGroup(id: string, reassignTo: string): Promise<void> {
  if (!reassignTo || reassignTo === id) throw new Error("Kies een groep om de categorieën naartoe te verplaatsen.");
  await db.transaction("rw", db.categories, db.categoryGroups, async () => {
    const members = await db.categories.where("groupId").equals(id).toArray();
    if (members.length) {
      const target = await db.categories.where("groupId").equals(reassignTo).toArray();
      let order = target.reduce((m, x) => Math.max(m, x.order ?? 0), -1);
      await db.categories.bulkPut(members.map((c) => ({ ...c, groupId: reassignTo, order: ++order })));
    }
    await db.categoryGroups.delete(id);
  });
  scheduleSync();
}

/* Zet een categorie in een (andere) groep op positie 'index' (drag & drop-drop).
 * Hernummert de orders binnen de doelgroep naar 0…N. */
export async function setCategoryGroup(catId: string, groupId: string, index?: number): Promise<void> {
  await db.transaction("rw", db.categories, async () => {
    const cat = await db.categories.get(catId);
    if (!cat) return;
    const others = (await db.categories.where("groupId").equals(groupId).toArray())
      .filter((c) => c.id !== catId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const at = index == null || index < 0 || index > others.length ? others.length : index;
    others.splice(at, 0, { ...cat, groupId });
    await db.categories.bulkPut(others.map((c, i) => ({ ...c, groupId, order: i })));
  });
  scheduleSync();
}

/* Verschuif een categorie één plek binnen zijn groep (order-swap met de buur). */
export async function moveCategoryOrder(catId: string, dir: "up" | "down"): Promise<void> {
  await db.transaction("rw", db.categories, async () => {
    const cat = await db.categories.get(catId);
    if (!cat) return;
    const ordered = (await db.categories.where("groupId").equals(cat.groupId).toArray())
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = ordered.findIndex((c) => c.id === catId);
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swap < 0 || swap >= ordered.length) return;
    const a = ordered[idx], b = ordered[swap];
    await db.categories.bulkPut([{ ...a, order: b.order ?? 0 }, { ...b, order: a.order ?? 0 }]);
  });
  scheduleSync();
}

/* Verschuif een categoriegroep één plek in de lijst (order-swap met de buur). */
export async function moveGroupOrder(id: string, dir: "up" | "down"): Promise<void> {
  await db.transaction("rw", db.categoryGroups, async () => {
    const ordered = (await db.categoryGroups.toArray()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = ordered.findIndex((g) => g.id === id);
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swap < 0 || swap >= ordered.length) return;
    const a = ordered[idx], b = ordered[swap];
    await db.categoryGroups.bulkPut([{ ...a, order: b.order ?? 0 }, { ...b, order: a.order ?? 0 }]);
  });
  scheduleSync();
}

/* ── Permanent wissen ── */
/* Verwijder ALLE transacties (en de bijbehorende import-historie). Onomkeerbaar. */
export async function clearTransactions(): Promise<void> {
  await db.transaction("rw", db.transactions, db.importBatches, async () => {
    await db.transactions.clear();
    await db.importBatches.clear();
  });
  scheduleSync();
}
/* Verwijder ALLE tegenpartij-koppelingen (opgeslagen categorie per tegenpartij). Onomkeerbaar. */
export async function clearPayees(): Promise<void> {
  await db.payees.clear();
  scheduleSync();
}

/* ── Regel-beheer ── */
export async function addRule(r: Omit<RuleRow, "id">): Promise<void> {
  await db.rules.put({ ...r, id: uid("r") });
  scheduleSync();
}
export async function updateRule(id: string, patch: Partial<Omit<RuleRow, "id">>): Promise<void> {
  await db.rules.update(id, patch);
  scheduleSync();
}
export async function deleteRule(id: string): Promise<void> {
  await db.rules.delete(id);
  scheduleSync();
}
