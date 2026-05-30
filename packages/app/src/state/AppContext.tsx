import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/schema";
import { rowToTx, rowToGoal, rowToPot } from "../db/map";
import { buildSavings, type SavingsGroup } from "../goals/savings";
import { lastTwelveMonthKeys } from "../helpers/aggregations";
import { fromCents } from "../lib/money";
import type { Category, CategoryGroupRow, Transaction, Goal, RuleRow, PayeeRow } from "../db/types";

export type ViewId = "dashboard" | "transacties" | "budgetten" | "spaardoel" | "tegenpartijen" | "import" | "sync" | "beheer" | "steun";

interface AppState {
  ready: boolean;
  categories: Category[];
  catMap: Record<string, Category>;
  categoryGroups: CategoryGroupRow[];
  groupMap: Record<string, CategoryGroupRow>;
  transactions: Transaction[];
  budgets: Record<string, number>; // categoryId -> euro (recurring)
  goals: Goal[];
  savingsGroups: SavingsGroup[];
  savingsLibrary: Category[];
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
  const groupRows = useLiveQuery(() => db.categoryGroups.toArray(), [], undefined);
  const txRows = useLiveQuery(() => db.transactions.toArray(), [], undefined);
  const budgetRows = useLiveQuery(() => db.budgets.toArray(), [], undefined);
  const goalRows = useLiveQuery(() => db.goals.toArray(), [], undefined);
  const ruleRows = useLiveQuery(() => db.rules.toArray(), [], undefined);
  const payeeRows = useLiveQuery(() => db.payees.toArray(), [], undefined);
  const potRows = useLiveQuery(() => db.pots.toArray(), [], undefined);

  const ready = !!categories && !!groupRows && !!txRows && !!budgetRows && !!goalRows && !!ruleRows && !!payeeRows && !!potRows;

  const value = useMemo<AppState>(() => {
    const cats = categories ?? [];
    const catMap = Object.fromEntries(cats.map((c) => [c.id, c]));
    const categoryGroups = [...(groupRows ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const groupMap = Object.fromEntries(categoryGroups.map((g) => [g.id, g]));
    const transactions: Transaction[] = (txRows ?? [])
      .map(rowToTx)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const budgets: Record<string, number> = {};
    for (const b of budgetRows ?? []) {
      if (b.month === null) budgets[b.categoryId] = fromCents(b.amountCents);
    }
    const goalsBase: Goal[] = (goalRows ?? []).map(rowToGoal).sort((a, b) => a.priority - b.priority);
    const pots = (potRows ?? []).map(rowToPot);
    const { groups: savingsGroups, library: savingsLibrary, filledById } = buildSavings(cats, goalsBase, transactions, pots);
    // voortgang afleiden: vervang current door de via waterfall toegekende waarde
    const goals: Goal[] = goalsBase.map((g) => ({ ...g, current: filledById.get(g.id) ?? g.current }));
    const rules = (ruleRows ?? []) as RuleRow[];
    const payees = (payeeRows ?? []) as PayeeRow[];
    const payeeMap = new Map(payees.filter((p) => p.categoryId).map((p) => [p.key, p.categoryId]));
    const uncategorizedCount = transactions.filter((t) => !t.category).length;

    return {
      ready, categories: cats, catMap, categoryGroups, groupMap, transactions, budgets, goals, savingsGroups, savingsLibrary, rules, payees, payeeMap,
      months, monthIdx, setMonthIdx, view, setView, uncategorizedCount,
    };
  }, [categories, groupRows, txRows, budgetRows, goalRows, ruleRows, payeeRows, potRows, ready, months, monthIdx, view]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
