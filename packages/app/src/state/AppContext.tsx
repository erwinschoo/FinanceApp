import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/schema";
import { rowToTx, rowToGoal, rowToPot } from "../db/map";
import { buildSavings, type SavingsGroup } from "../goals/savings";
import { txKey, yearOf } from "../helpers/aggregations";
import { monthKeyLabelFull } from "../lib/format";
import { fromCents } from "../lib/money";
import type { Category, CategoryGroupRow, Transaction, Goal, RuleRow, PayeeRow, HouseholdProfile } from "../db/types";

export const VIEW_IDS = ["dashboard", "transacties", "budgetten", "vergelijken", "spaardoel", "tegenpartijen", "import", "sync", "beheer", "profiel", "feedback", "steun", "download", "informatie"] as const;
export type ViewId = (typeof VIEW_IDS)[number];

/* Leidt de actieve view af uit de URL-hash (bijv. "#sync"); null bij ontbrekende/onbekende hash. */
function viewFromHash(): ViewId | null {
  const h = window.location.hash.replace(/^#\/?/, "");
  return (VIEW_IDS as readonly string[]).includes(h) ? (h as ViewId) : null;
}

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
  // Periode-selectie: een maand ("YYYY-MM") of een heel jaar (periodMonth === "all").
  periodYear: number;
  periodMonth: number | "all"; // 1..12 of "all" (heel jaar)
  setPeriodYear: (y: number) => void;
  setPeriodMonth: (m: number | "all") => void;
  periodMode: "month" | "year";
  periodKey: string | null;       // "YYYY-MM" in maand-modus, anders null
  periodMonthKeys: string[];      // maand: [periodKey]; jaar: data-maanden van dat jaar (oplopend)
  periodMonthCount: number;       // aantal maanden in de periode (maand=1; jaar=aantal data-maanden)
  periodLabel: string;            // "mei 2026" of "Heel 2026"
  dataMonthKeys: string[];        // unieke maand-keys in de data (oplopend)
  dataYears: number[];            // jaren in de data (aflopend)
  view: ViewId;
  setView: (v: ViewId, focus?: string) => void;
  focusTarget: string | null; // optioneel scroll/focus-doel binnen het zojuist geopende scherm
  uncategorizedCount: number;
  startBalance: number; // beginsaldo betaalrekening (euro); 0 als niet ingesteld
  hasImportedBalance: boolean; // import levert een echt banksaldo mee
  derivedStartBalance: number | null; // beginsaldo afgeleid uit de oudste transactie met banksaldo
  startBalanceKnown: boolean; // beginsaldo is bekend (import óf handmatig ingevuld)
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp buiten AppProvider");
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setViewState] = useState<ViewId>(() => viewFromHash() ?? "dashboard");
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);
  const [periodYear, setPeriodYearState] = useState<number>(() => now.getFullYear());
  const [periodMonth, setPeriodMonthState] = useState<number | "all">(() => now.getMonth() + 1);

  // Navigatie schrijft de view in de URL-hash, zodat deep links, verversen en de
  // (mobiele) terug-knop blijven werken zonder een router-library. Een optioneel
  // focus-doel laat het doelscherm naar een specifieke sectie scrollen.
  const setView = useCallback((v: ViewId, focus?: string) => {
    setFocusTarget(focus ?? null);
    setViewState(v);
    if (window.location.hash.replace(/^#\/?/, "") !== v) window.history.pushState(null, "", `#${v}`);
  }, []);

  useEffect(() => {
    // Zet alleen een default-hash als er NOG GEEN hash is. Een niet-lege hash die
    // geen bekende view is laten we met rust — met name de MSAL OAuth-respons
    // ("#code=...&state=...") die in het login-popupvenster op de redirectUri
    // (de app-root) belandt. Zou de router die overschrijven, dan faalt de
    // OneDrive-login met "hash_does_not_contain_known_properties".
    if (!window.location.hash) window.history.replaceState(null, "", "#dashboard");
    const onPop = () => setViewState(viewFromHash() ?? "dashboard");
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPop);
    };
  }, []);

  const categories = useLiveQuery(() => db.categories.toArray(), [], undefined);
  const groupRows = useLiveQuery(() => db.categoryGroups.toArray(), [], undefined);
  const txRows = useLiveQuery(() => db.transactions.toArray(), [], undefined);
  const budgetRows = useLiveQuery(() => db.budgets.toArray(), [], undefined);
  const goalRows = useLiveQuery(() => db.goals.toArray(), [], undefined);
  const ruleRows = useLiveQuery(() => db.rules.toArray(), [], undefined);
  const payeeRows = useLiveQuery(() => db.payees.toArray(), [], undefined);
  const potRows = useLiveQuery(() => db.pots.toArray(), [], undefined);
  const profileRow = useLiveQuery(() => db.meta.get("profile"), [], undefined);

  const ready = !!categories && !!groupRows && !!txRows && !!budgetRows && !!goalRows && !!ruleRows && !!payeeRows && !!potRows;

  // Transacties (nieuwste eerst) — apart gememoïseerd zodat de maand-default ze kan gebruiken.
  const transactions = useMemo<Transaction[]>(
    () => (txRows ?? []).map(rowToTx).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [txRows],
  );

  // Unieke maand-keys/jaren in de data (oplopend resp. aflopend) — bron voor de periode-picker.
  const dataMonthKeys = useMemo(
    () => Array.from(new Set(transactions.map(txKey))).sort(),
    [transactions],
  );
  const dataYears = useMemo(
    () => Array.from(new Set(dataMonthKeys.map((k) => Number(yearOf(k))))).sort((a, b) => b - a),
    [dataMonthKeys],
  );

  // Default-periode = nieuwste maand mét data (anders de huidige maand). Zo toont de app meteen de
  // laatste maand mét cijfers. Eenmalig toegepast zodra de data klaar is; een handmatige keuze wint daarna.
  const periodTouched = useRef(false);
  const setPeriodMonth = useCallback((m: number | "all") => { periodTouched.current = true; setPeriodMonthState(m); }, []);
  const setPeriodYear = useCallback((y: number) => { periodTouched.current = true; setPeriodYearState(y); }, []);
  useEffect(() => {
    if (!ready || periodTouched.current) return;
    const latest = dataMonthKeys[dataMonthKeys.length - 1];
    if (latest) {
      const [y, m] = latest.split("-").map(Number);
      setPeriodYearState(y);
      setPeriodMonthState(m);
    }
  }, [ready, dataMonthKeys]);

  const value = useMemo<AppState>(() => {
    const cats = categories ?? [];
    const catMap = Object.fromEntries(cats.map((c) => [c.id, c]));
    const categoryGroups = [...(groupRows ?? [])].sort((a, b) => a.name.localeCompare(b.name, "nl"));
    const groupMap = Object.fromEntries(categoryGroups.map((g) => [g.id, g]));
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
    const profile = profileRow?.value as HouseholdProfile | undefined;
    const startBalance = fromCents(profile?.startBalanceCents ?? 0);

    // Beginsaldo afleiden uit de import: de oudste transactie met een banksaldo
    // (transacties staan nieuwste-eerst) geeft het saldo ná die transactie; het
    // openingssaldo dáárvoor is dat saldo minus het bedrag van die transactie.
    const hasImportedBalance = transactions.some((t) => t.balance != null);
    let derivedStartBalance: number | null = null;
    for (let i = transactions.length - 1; i >= 0; i--) {
      const t = transactions[i];
      if (t.balance != null) { derivedStartBalance = t.balance - t.amount; break; }
    }
    const startBalanceKnown = hasImportedBalance || (profile?.startBalanceCents ?? 0) !== 0;

    // Afgeleide periode-waarden.
    const periodMode: "month" | "year" = periodMonth === "all" ? "year" : "month";
    const periodKey = periodMode === "month" ? `${periodYear}-${String(periodMonth).padStart(2, "0")}` : null;
    const yearPrefix = `${periodYear}-`;
    const periodMonthKeys = periodMode === "month"
      ? [periodKey as string]
      : dataMonthKeys.filter((k) => k.startsWith(yearPrefix));
    const periodMonthCount = periodMonthKeys.length;
    const periodLabel = periodMode === "month" ? monthKeyLabelFull(periodKey as string) : `Heel ${periodYear}`;

    return {
      ready, categories: cats, catMap, categoryGroups, groupMap, transactions, budgets, goals, savingsGroups, savingsLibrary, rules, payees, payeeMap,
      periodYear, periodMonth, setPeriodYear, setPeriodMonth, periodMode, periodKey, periodMonthKeys, periodMonthCount, periodLabel, dataMonthKeys, dataYears,
      view, setView, focusTarget, uncategorizedCount,
      startBalance, hasImportedBalance, derivedStartBalance, startBalanceKnown,
    };
  }, [categories, groupRows, transactions, budgetRows, goalRows, ruleRows, payeeRows, potRows, profileRow, ready,
      periodYear, periodMonth, setPeriodYear, setPeriodMonth, dataMonthKeys, dataYears, view, focusTarget, setView]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
