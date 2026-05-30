import Dexie, { type Table } from "dexie";
import type {
  Category, TxRow, BudgetRow, RuleRow, GoalRow,
  ImportBatchRow, ImportProfileRow, MetaRow, PayeeRow,
} from "./types";
import { DEFAULT_CATEGORIES, ADDED_IN_V3, V3_PARENTING } from "../categories";

export class FinanceDB extends Dexie {
  categories!: Table<Category, string>;
  transactions!: Table<TxRow, string>;
  budgets!: Table<BudgetRow, string>;
  rules!: Table<RuleRow, string>;
  goals!: Table<GoalRow, string>;
  importBatches!: Table<ImportBatchRow, string>;
  importProfiles!: Table<ImportProfileRow, string>;
  meta!: Table<MetaRow, string>;
  payees!: Table<PayeeRow, string>;

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
      const table = tx.table("categories");
      const existing: Category[] = await table.toArray();
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
        const patch: Partial<Category> = {};
        const desiredParent = V3_PARENTING[c.id] ?? null;
        if (c.parentId === undefined) patch.parentId = desiredParent;
        else if (V3_PARENTING[c.id] && !c.parentId) patch.parentId = V3_PARENTING[c.id];
        if ("parentId" in patch) await table.update(c.id, patch);
      }
    });
  }
}

export const db = new FinanceDB();
