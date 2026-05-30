import Dexie, { type Table } from "dexie";
import type {
  Category, TxRow, BudgetRow, RuleRow, GoalRow,
  ImportBatchRow, ImportProfileRow, MetaRow,
} from "./types";

export class FinanceDB extends Dexie {
  categories!: Table<Category, string>;
  transactions!: Table<TxRow, string>;
  budgets!: Table<BudgetRow, string>;
  rules!: Table<RuleRow, string>;
  goals!: Table<GoalRow, string>;
  importBatches!: Table<ImportBatchRow, string>;
  importProfiles!: Table<ImportProfileRow, string>;
  meta!: Table<MetaRow, string>;

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
  }
}

export const db = new FinanceDB();
