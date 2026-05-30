import Dexie, { type Table } from "dexie";
import type {
  Category, CategoryGroupRow, TxRow, BudgetRow, RuleRow, GoalRow,
  ImportBatchRow, ImportProfileRow, MetaRow, PayeeRow, PotRow,
} from "./types";
import { DEFAULT_CATEGORIES, ADDED_IN_V3, V3_PARENTING, DEFAULT_GROUPS, V5_GROUPING, fallbackGroupForType } from "../categories";

export class FinanceDB extends Dexie {
  categories!: Table<Category, string>;
  categoryGroups!: Table<CategoryGroupRow, string>;
  transactions!: Table<TxRow, string>;
  budgets!: Table<BudgetRow, string>;
  rules!: Table<RuleRow, string>;
  goals!: Table<GoalRow, string>;
  importBatches!: Table<ImportBatchRow, string>;
  importProfiles!: Table<ImportProfileRow, string>;
  meta!: Table<MetaRow, string>;
  payees!: Table<PayeeRow, string>;
  pots!: Table<PotRow, string>;

  constructor() {
    super("financeapp");
    this.version(1).stores({
      categories: "id",
      transactions: "id, date, category, dedupeHash, importBatchId",
      budgets: "id, categoryId, month",
      rules: "id, categoryId, priority",
      goals: "id, priority",
      importBatches: "id, importedAt",
      importProfiles: "id, bankName",
      meta: "key",
    });
    // v2: tegenpartijen + extra transactions-indexen voor retro-apply per payee
    this.version(2).stores({
      transactions: "id, date, category, dedupeHash, importBatchId, counterIban, merchant",
      payees: "key, categoryId, kind",
    });
    // v3: subcategorieën (parentId) + nieuwe categorieën; eenmalige, additieve migratie
    this.version(3).stores({
      categories: "id, parentId, type",
    }).upgrade(async (tx) => {
      // legacy-vorm: in v3 had een categorie nog een parentId (later vervangen door groupId in v5)
      type V3Cat = { id: string; parentId?: string | null };
      const table = tx.table("categories");
      const existing: V3Cat[] = await table.toArray();
      const byId = new Set(existing.map((c) => c.id));
      const defById = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c]));
      // nieuwe categorieën toevoegen (groep + nieuwe leaves)
      for (const id of ADDED_IN_V3) {
        if (!byId.has(id)) {
          const def = defById.get(id);
          if (def) await table.put(def);
        }
      }
      // parentId zetten op bestaande categorieën (additief; bestaande keuzes blijven)
      for (const c of existing) {
        const patch: { parentId?: string | null } = {};
        const desiredParent = V3_PARENTING[c.id] ?? null;
        if (c.parentId === undefined) patch.parentId = desiredParent;
        else if (V3_PARENTING[c.id] && !c.parentId) patch.parentId = V3_PARENTING[c.id];
        if ("parentId" in patch) await table.update(c.id, patch);
      }
    });
    // v4: spaarpotten (startsaldo + tekenrichting per categorie) voor doel-tracking
    this.version(4).stores({
      pots: "categoryId",
    });
    // v5: aparte categoriegroepen (puur organisatorisch). parentId-hiërarchie → groupId.
    this.version(5).stores({
      categoryGroups: "id, order",
      categories: "id, groupId, type", // parentId-index vervangen door groupId
    }).upgrade(async (tx) => {
      const groupTable = tx.table("categoryGroups");
      const catTable = tx.table("categories");
      const txTable = tx.table("transactions");
      const payeeTable = tx.table("payees");

      // 1. standaardgroepen seeden (alleen ontbrekende)
      const existingGroupIds = new Set((await groupTable.toArray()).map((g: CategoryGroupRow) => g.id));
      for (const g of DEFAULT_GROUPS) if (!existingGroupIds.has(g.id)) await groupTable.put(g);

      // 2. de oude groep-categorie "vaste-lasten" was zelf een Category → omzetten naar groep:
      //    losse transacties/payees die er direct naar verwezen herverdelen naar "overig".
      type LegacyCat = Category & { parentId?: string | null };
      const cats: LegacyCat[] = await catTable.toArray();
      if (cats.some((c) => c.id === "vaste-lasten")) {
        const strayTx = await txTable.where("category").equals("vaste-lasten").toArray();
        if (strayTx.length) await txTable.bulkPut(strayTx.map((t: TxRow) => ({ ...t, category: "overig" })));
        const strayPayees = (await payeeTable.toArray()).filter((p: PayeeRow) => p.categoryId === "vaste-lasten");
        if (strayPayees.length) await payeeTable.bulkPut(strayPayees.map((p: PayeeRow) => ({ ...p, categoryId: "overig" })));
        await catTable.delete("vaste-lasten");
      }

      // 3. groupId + order zetten op elke resterende categorie
      const remaining = cats.filter((c) => c.id !== "vaste-lasten");
      remaining.sort((a, b) => a.name.localeCompare(b.name, "nl"));
      const orderByGroup: Record<string, number> = {};
      for (const c of remaining) {
        const groupId =
          V5_GROUPING[c.id] ??
          (c.parentId === "vaste-lasten" ? "grp-vaste-lasten" : undefined) ??
          fallbackGroupForType(c.type);
        const order = orderByGroup[groupId] = (orderByGroup[groupId] ?? -1) + 1;
        await catTable.update(c.id, { groupId, order, parentId: undefined });
      }
    });
  }
}

export const db = new FinanceDB();
