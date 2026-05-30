/* FinanceApp — root: state, context provider, shell */
function App() {
  const D = window.FA_DATA;
  const [view, setView] = React.useState("dashboard");
  const [monthIdx, setMonthIdx] = React.useState(D.months.length - 1); // current month
  const [transactions, setTransactions] = React.useState(() => D.transactions.map(t => ({ ...t })));
  const [budgets, setBudgets] = React.useState(() => ({ ...D.BUDGETS }));
  const [savings, setSavings] = React.useState(() => ({ ...D.SAVINGS }));

  const updateCat = React.useCallback((id, cat) => {
    setTransactions(ts => ts.map(t => t.id === id ? { ...t, category: cat, auto: false } : t));
  }, []);
  const setBudget = React.useCallback((id, val) => {
    setBudgets(b => ({ ...b, [id]: val }));
  }, []);

  const uncategorizedCount = React.useMemo(
    () => transactions.filter(t => !t.category).length, [transactions]);

  const value = {
    view, setView, monthIdx, setMonthIdx, months: D.months,
    transactions, setTransactions, updateCat,
    budgets, setBudget, savings, setSavings,
  };

  const META = {
    dashboard:   { title: "Overzicht",   sub: "Je financiële beeld in één oogopslag", month: true },
    transacties: { title: "Transacties", sub: "Controleer en deel je uitgaven in", month: true },
    budgetten:   { title: "Budgetten",   sub: "Stem je budget af per categorie", month: true },
    spaardoel:   { title: "Spaardoel",   sub: "Stel een doel en volg je voortgang", month: false },
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
