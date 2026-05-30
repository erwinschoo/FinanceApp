/* FinanceApp — root: state, context provider, shell */
function App() {
  const D = window.FA_DATA;
  const [view, setView] = React.useState("dashboard");
  const [monthIdx, setMonthIdx] = React.useState(D.months.length - 1); // current month
  const [transactions, setTransactions] = React.useState(() => D.transactions.map(t => ({ ...t })));
  const [budgets, setBudgets] = React.useState(() => ({ ...D.BUDGETS }));
  const [savings, setSavings] = React.useState(() => ({ ...D.SAVINGS }));
  const [savingsGroups, setSavingsGroups] = React.useState(
    () => D.SAVINGS_GROUPS.map(g => ({ ...g, goals: g.goals.map(x => ({ ...x })) })));

  const updateCat = React.useCallback((id, cat) => {
    setTransactions(ts => ts.map(t => t.id === id ? { ...t, category: cat, auto: false } : t));
  }, []);
  const setBudget = React.useCallback((id, val) => {
    setBudgets(b => ({ ...b, [id]: val }));
  }, []);

  // ── savings-group actions ──
  let _ngid = React.useRef(1000);
  const sgActions = React.useMemo(() => ({
    addCategory: (lib) => setSavingsGroups(gs => gs.some(g => g.id === lib.id) ? gs
      : [...gs, { ...lib, monthly: 100, balance: 0, goals: [{ id: "g" + (_ngid.current++), name: "Nieuw doel", target: 5000, priority: 1 }] }]),
    removeCategory: (gid) => setSavingsGroups(gs => gs.filter(g => g.id !== gid)),
    setMonthly: (gid, v) => setSavingsGroups(gs => gs.map(g => g.id === gid ? { ...g, monthly: v } : g)),
    setBalance: (gid, v) => setSavingsGroups(gs => gs.map(g => g.id === gid ? { ...g, balance: v } : g)),
    addGoal: (gid) => setSavingsGroups(gs => gs.map(g => g.id === gid
      ? { ...g, goals: [...g.goals, { id: "g" + (_ngid.current++), name: "Nieuw doel", target: 5000, priority: Math.max(0, ...g.goals.map(x => x.priority)) + 1 }] } : g)),
    updateGoal: (gid, goalId, patch) => setSavingsGroups(gs => gs.map(g => g.id === gid
      ? { ...g, goals: g.goals.map(x => x.id === goalId ? { ...x, ...patch } : x) } : g)),
    removeGoal: (gid, goalId) => setSavingsGroups(gs => gs.map(g => g.id === gid
      ? { ...g, goals: g.goals.filter(x => x.id !== goalId) } : g)),
    move: (gid, goalId, dir) => setSavingsGroups(gs => gs.map(g => {
      if (g.id !== gid) return g;
      const ordered = g.goals.slice().sort((a, b) => a.priority - b.priority);
      const i = ordered.findIndex(x => x.id === goalId);
      const j = i + dir;
      if (j < 0 || j >= ordered.length) return g;
      const a = ordered[i], b = ordered[j];
      const pa = a.priority, pb = b.priority;
      return { ...g, goals: g.goals.map(x => x.id === a.id ? { ...x, priority: pb } : x.id === b.id ? { ...x, priority: pa } : x) };
    })),
  }), []);

  const uncategorizedCount = React.useMemo(
    () => transactions.filter(t => !t.category).length, [transactions]);

  const value = {
    view, setView, monthIdx, setMonthIdx, months: D.months,
    transactions, setTransactions, updateCat,
    budgets, setBudget, savings, setSavings,
    savingsGroups, setSavingsGroups, sgActions,
  };

  const META = {
    dashboard:   { title: "Overzicht",   sub: "Je financiële beeld in één oogopslag", month: true },
    transacties: { title: "Transacties", sub: "Controleer en deel je uitgaven in", month: true },
    budgetten:   { title: "Budgetten",   sub: "Stem je budget af per categorie", month: true },
    spaardoel:   { title: "Spaardoelen", sub: "Stel doelen per categorie en volg je voortgang", month: false },
    import:      { title: "Importeren",  sub: "Laad je banktransacties in via Excel", month: false },
  };
  const meta = META[view];

  const ViewComp = {
    dashboard: DashboardView, transacties: TransactionsView,
    budgetten: BudgetsView, spaardoel: SavingsView, import: ImportView,
  }[view];

  return (
    <FAContext.Provider value={value}>
      <div className="app">
        <Sidebar view={view} setView={setView} uncategorizedCount={uncategorizedCount} />
        <div className="main">
          <header className="topbar">
            <div>
              <h1>{meta.title}</h1>
              <div className="sub">{meta.sub}</div>
            </div>
            <div className="spacer"></div>
            {meta.month && <MonthPicker />}
            {view !== "import" && (
              <button className="btn btn-primary" onClick={() => setView("import")}>
                <Ic name="upload" size={16} /> Importeren
              </button>
            )}
          </header>
          <main className="content scroll">
            <ViewComp />
          </main>
        </div>
      </div>
    </FAContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
