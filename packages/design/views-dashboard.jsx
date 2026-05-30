/* FinanceApp — Dashboard (Overzicht) view */
function DashboardView() {
  const ctx = React.useContext(FAContext);
  const { transactions, months, monthIdx, budgets, savingsGroups, setView } = ctx;
  const H = window.FAhelpers;
  const START_BALANCE = 4200;
  const [donutActive, setDonutActive] = React.useState(null);
  const [trendMode, setTrendMode] = React.useState("beide"); // beide | netto

  const mo = months[monthIdx];
  const key = mo.key;

  // per-month series across the 12 months
  const series = React.useMemo(() => {
    return months.map(m => {
      const txs = H.txInMonth(transactions, m.key);
      return { key: m.key, income: H.incomeOf(txs), expense: H.expensesOf(txs), saved: H.savingsOf(txs) };
    });
  }, [transactions, months]);

  const cur = series[monthIdx];
  const prev = monthIdx > 0 ? series[monthIdx - 1] : null;
  const pct = (a, b) => (b ? ((a - b) / b) * 100 : 0);

  // balance at end of any month index
  const balanceAt = React.useCallback((idx) => {
    const end = months[idx].key;
    let b = START_BALANCE;
    transactions.forEach(t => { if (t.date.slice(0, 7) <= end) b += t.amount; });
    return b;
  }, [transactions, months]);
  const balance = balanceAt(monthIdx);
  const prevBalance = monthIdx > 0 ? balanceAt(monthIdx - 1) : null;

  // spend by category for selected month
  const monthTxs = H.txInMonth(transactions, key);
  const spend = H.spendByCat(monthTxs);
  const donutData = D.CATS.filter(c => c.id !== "inkomen" && spend[c.id])
    .map(c => ({ label: c.name, value: spend[c.id], color: c.color, id: c.id }))
    .sort((a, b) => b.value - a.value);
  const totalSpend = donutData.reduce((s, d) => s + d.value, 0);

  // sparklines (last 6 months)
  const last6 = (sel) => series.slice(Math.max(0, monthIdx - 5), monthIdx + 1).map(sel);

  // trend chart series
  const labels = months.map(m => H.monthLabelShort(m));
  const trendSeries = trendMode === "beide"
    ? [
        { key: "inkomen", name: "Inkomsten", color: "var(--blue)", data: series.map(s => s.income) },
        { key: "uitgaven", name: "Uitgaven", color: "var(--orange)", data: series.map(s => s.expense) },
      ]
    : [
        { key: "netto", name: "Netto over", color: "var(--pos)", data: series.map(s => Math.max(0, s.income - s.expense)) },
      ];

  // budget status (top categories)
  const budgetRows = D.CATS.filter(c => budgets[c.id]).map(c => ({
    c, spent: spend[c.id] || 0, budget: budgets[c.id],
  })).sort((a, b) => (b.spent / b.budget) - (a.spent / a.budget)).slice(0, 5);

  // recent tx in month
  const recent = monthTxs.slice(0, 6);

  const netMonth = cur.income - cur.expense;

  // savings summary across all groups + primary active goal
  const sav = React.useMemo(() => {
    const totalBalance = savingsGroups.reduce((s, g) => s + g.balance, 0);
    const totalTarget = savingsGroups.reduce((s, g) => s + g.goals.reduce((a, x) => a + x.target, 0), 0);
    let primary = null;
    for (const g of savingsGroups) {
      const a = allocateGoals(g);
      if (!a.allDone) { primary = { g, goal: a.rows[a.activeIdx] }; break; }
    }
    if (!primary && savingsGroups[0]) {
      const a = allocateGoals(savingsGroups[0]);
      primary = { g: savingsGroups[0], goal: a.rows[a.rows.length - 1] };
    }
    return { totalBalance, totalTarget, primary };
  }, [savingsGroups]);

  return (
    <div className="content-inner fade-in">
      {/* KPI row */}
      <div className="grid stagger" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 18 }}>
        <KpiCard icon="wallet" iconColor="var(--blue)" iconBg="var(--blue-soft)"
          label="Saldo betaalrekening" value={eur(balance)} delta={prevBalance ? pct(balance, prevBalance) : null}
          deltaNote="vs. vorige maand" spark={last6(s => s.income - s.expense)} sparkColor="var(--blue)" />
        <KpiCard icon="arrowDown" iconColor="var(--pos)" iconBg="var(--pos-soft)"
          label="Inkomsten" value={eur(cur.income)} delta={prev ? pct(cur.income, prev.income) : null}
          deltaNote="vs. vorige maand" spark={last6(s => s.income)} sparkColor="var(--pos)" />
        <KpiCard icon="arrowUp" iconColor="var(--orange)" iconBg="var(--orange-soft)"
          label="Uitgaven" value={eur(cur.expense)} delta={prev ? pct(cur.expense, prev.expense) : null}
          deltaNote="vs. vorige maand" spark={last6(s => s.expense)} sparkColor="var(--orange)" />
        <KpiCard icon="piggy" iconColor="var(--cat-4)" iconBg="#F2EFF7"
          label="Gespaard" value={eur(cur.saved)} delta={prev ? pct(cur.saved, prev.saved) : null}
          deltaNote="naar spaardoel" spark={last6(s => s.saved)} sparkColor="var(--cat-4)" />
      </div>

      {/* trend + donut */}
      <div className="grid" style={{ gridTemplateColumns: "1.62fr 1fr", marginBottom: 18 }}>
        <div className="card card-pad">
          <div className="card-h">
            <h3>Inkomsten &amp; uitgaven</h3>
            <div className="seg" style={{ marginLeft: "auto" }}>
              <button className={trendMode === "beide" ? "on" : ""} onClick={() => setTrendMode("beide")}>Beide</button>
              <button className={trendMode === "netto" ? "on" : ""} onClick={() => setTrendMode("netto")}>Netto over</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 18, margin: "4px 0 10px" }}>
            {trendSeries.map(s => (
              <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--body)" }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color }}></span>{s.name}
              </span>
            ))}
          </div>
          <TrendChart series={trendSeries} labels={labels} height={262} />
        </div>

        <div className="card card-pad">
          <div className="card-h"><h3>Uitgaven per categorie</h3></div>
          <div className="card-sub" style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>{monthLabelFull(mo)}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div className="ring-wrap" style={{ flex: "none" }}>
              <DonutChart data={donutData} size={158} thickness={22} active={donutActive} onHover={setDonutActive} />
              <div className="ring-center">
                <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>
                  {donutActive != null ? donutData[donutActive].label : "Totaal"}
                </div>
                <div className="tnum" style={{ fontSize: 19, fontWeight: 800, color: "var(--ink)" }}>
                  {eur(donutActive != null ? donutData[donutActive].value : totalSpend)}
                </div>
              </div>
            </div>
            <div className="legend" style={{ flex: 1, minWidth: 0 }}>
              {donutData.slice(0, 6).map((d, i) => (
                <div className="legend-row" key={d.id}
                  onMouseEnter={() => setDonutActive(i)} onMouseLeave={() => setDonutActive(null)}
                  style={{ background: donutActive === i ? "var(--subtle)" : "transparent" }}>
                  <span className="d" style={{ background: d.color }}></span>
                  <span className="ln">{d.label}</span>
                  <span className="lv tnum">{eur(d.value)}</span>
                  <span className="lp tnum">{Math.round((d.value / totalSpend) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* budget status + savings */}
      <div className="grid" style={{ gridTemplateColumns: "1.62fr 1fr" }}>
        <div className="card card-pad">
          <div className="card-h">
            <h3>Budgetstatus</h3>
            <button className="btn btn-ghost" style={{ marginLeft: "auto", padding: "5px 10px" }} onClick={() => setView("budgetten")}>
              Alle budgetten <Ic name="chevronRight" size={15} />
            </button>
          </div>
          <div style={{ marginTop: 4 }}>
            {budgetRows.map(({ c, spent, budget }) => {
              const r = spent / budget;
              const col = budgetColor(r);
              return (
                <div className="bud" key={c.id}>
                  <div className="bud-top">
                    <span className="dot" style={{ width: 9, height: 9, borderRadius: "50%", background: c.color }}></span>
                    <span className="bud-name">{c.name}</span>
                    <span className="bud-fig tnum"><b>{eur(spent)}</b> / {eur(budget)}</span>
                  </div>
                  <div className="bar"><span style={{ width: Math.min(100, r * 100) + "%", background: col }}></span></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card card-pad" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-h"><h3>Spaardoelen</h3>
            <button className="btn btn-ghost" style={{ marginLeft: "auto", padding: "5px 10px" }} onClick={() => setView("spaardoel")}>
              Details <Ic name="chevronRight" size={15} />
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "8px 0 4px" }}>
            <div className="ring-wrap">
              <ProgressRing value={sav.totalBalance} max={sav.totalTarget} size={150} thickness={14} color="var(--blue)" />
              <div className="ring-center">
                <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>{sav.totalTarget ? Math.round((sav.totalBalance / sav.totalTarget) * 100) : 0}%</div>
                <div className="tnum" style={{ fontSize: 21, fontWeight: 800, color: "var(--ink)" }}>{eur(sav.totalBalance)}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>van {eur(sav.totalTarget)}</div>
              </div>
            </div>
            {sav.primary && (
              <div style={{ marginTop: 16, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: sav.primary.g.color }}></span>{sav.primary.g.name} · actief
                </div>
                <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 14.5, marginTop: 3 }}>{sav.primary.goal.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }} className="tnum">
                  {eur(sav.primary.goal.filled)} van {eur(sav.primary.goal.target)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* recent transactions */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-pad" style={{ paddingBottom: 4 }}>
          <div className="card-h">
            <h3>Recente transacties</h3>
            <button className="btn btn-ghost" style={{ marginLeft: "auto", padding: "5px 10px" }} onClick={() => setView("transacties")}>
              Alle transacties <Ic name="chevronRight" size={15} />
            </button>
          </div>
        </div>
        <div style={{ padding: "0 10px 8px" }}>
          <table className="tbl">
            <tbody>
              {recent.map(t => (
                <tr className="row" key={t.id}>
                  <td style={{ width: "50%" }}>
                    <div className="merchant">
                      <MerchantAv t={t} />
                      <div>
                        <div className="mn">{t.merchant}</div>
                        <div className="md">{fmtDate(t.date)}{t.note ? " · " + t.note : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td>{t.category ? <CatTag catId={t.category} small /> : <CatTag catId="" small />}</td>
                  <td className={"amt tnum " + (t.amount >= 0 ? "pos" : "neg")}>{eurSign(t.amount, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
window.DashboardView = DashboardView;
