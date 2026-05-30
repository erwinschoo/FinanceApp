import Dexie, { type Table } from "dexie";
import type {
  Category, TxRow, BudgetRow, RuleRow, GoalRow,
  ImportBatchRow, ImportProfileRow, MetaRow, PayeeRow,
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
  }
}

export const db = new FinanceDB();
