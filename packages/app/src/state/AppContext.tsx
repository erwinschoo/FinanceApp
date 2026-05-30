import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/schema";
import { rowToTx, rowToGoal } from "../db/map";
import { lastTwelveMonthKeys } from "../helpers/aggregations";
import { fromCents } from "../lib/money";
import type { Category, Transaction, Goal, RuleRow, PayeeRow } from "../db/types";

export type ViewId = "dashboard" | "transacties" | "budgetten" | "spaardoel" | "tegenpartijen" | "import" | "sync" | "beheer";

interface AppState {
  ready: boolean;
  categories: Category[];
  catMap: Record<string, Category>;
  transactions: Transaction[];
  budgets: Record<string, number>; // categoryId -> euro (recurring)
  goals: Goal[];
  rules: RuleRow[];
  payees: PayeeRow[];
  payeeMap: Map<string, string>; // key -> categoryId
  months: string[];
  monthIdx: number;
  setMonthIdx: (i: number) => void;
  view: ViewId;
  setView: (v: ViewId) => void;
  uncategorizedCount: number;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp buiten AppProvider");
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewId>("dashboard");
  const months = useMemo(() => lastTwelveMonthKeys(), []);
  const [monthIdx, setMonthIdx] = useState(months.length - 1);

  const categories = useLiveQuery(() => db.categories.toArray(), [], undefined);
  const txRows = useLiveQuery(() => db.transactions.toArray(), [], undefined);
  const budgetRows = useLiveQuery(() => db.budgets.toArray(), [], undefined);
  const goalRows = useLiveQuery(() => db.goals.toArray(), [], undefined);
  const ruleRows = useLiveQuery(() => db.rules.toArray(), [], undefined);
  const payeeRows = useLiveQuery(() => db.payees.toArray(), [], undefined);

  const ready = !!categories && !!txRows && !!budgetRows && !!goalRows && !!ruleRows && !!payeeRows;

  const value = useMemo<AppState>(() => {
    const cats = categories ?? [];
    const catMap = Object.fromEntries(cats.map((c) => [c.id, c]));
    const transactions: Transaction[] = (txRows ?? [])
      .map(rowToTx)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const budgets: Record<string, number> = {};
    for (const b of budgetRows ?? []) {
      if (b.month === null) budgets[b.categoryId] = fromCents(b.amountCents);
    }
    const goals: Goal[] = (goalRows ?? []).map(rowToGoal).sort((a, b) => a.priority - b.priority);
    const rules = (ruleRows ?? []) as RuleRow[];
    const payees = (payeeRows ?? []) as PayeeRow[];
    const payeeMap = new Map(payees.filter((p) => p.categoryId).map((p) => [p.key, p.categoryId]));
    const uncategorizedCount = transactions.filter((t) => !t.category).length;

    return {
      ready, categories: cats, catMap, transactions, budgets, goals, rules, payees, payeeMap,
      months, monthIdx, setMonthIdx, view, setView, uncategorizedCount,
    };
  }, [categories, txRows, budgetRows, goalRows, ruleRows, payeeRows, ready, months, monthIdx, view]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
