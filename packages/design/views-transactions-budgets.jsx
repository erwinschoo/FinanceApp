/* FinanceApp — Transacties & Budgetten views */

function TransactionsView() {
  const ctx = React.useContext(FAContext);
  const { transactions, updateCat, months, monthIdx } = ctx;
  const H = window.FAhelpers;
  const [q, setQ] = React.useState("");
  const [scope, setScope] = React.useState("maand"); // maand | alle
  const [catFilter, setCatFilter] = React.useState("alle");
  const [onlyUncat, setOnlyUncat] = React.useState(false);

  const key = months[monthIdx].key;
  let rows = transactions;
  if (scope === "maand") rows = rows.filter(t => H.txKey(t) === key);
  if (catFilter !== "alle") rows = rows.filter(t => (catFilter === "leeg" ? !t.category : t.category === catFilter));
  if (onlyUncat) rows = rows.filter(t => !t.category);
  if (q.trim()) {
    const s = q.toLowerCase();
    rows = rows.filter(t => t.merchant.toLowerCase().includes(s) || (t.note || "").toLowerCase().includes(s));
  }

  const uncatCount = transactions.filter(t => !t.category && H.txKey(t) === key).length;
  const totalOut = rows.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalIn = rows.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);

  return (
    <div className="content-inner fade-in">
      {uncatCount > 0 && (
        <div className="notice" style={{ marginBottom: 18 }}>
          <span className="ni"><Ic name="info" size={20} /></span>
          <div className="nt">
            <b>{uncatCount} transactie{uncatCount === 1 ? "" : "s"} wacht{uncatCount === 1 ? "" : "en"} op indeling.</b> Klik op een categorie-label om ze toe te wijzen — daarna tellen ze mee in je budgetten.
            <button className="btn btn-ghost" style={{ marginLeft: 10, padding: "3px 10px", color: "var(--blue)" }}
              onClick={() => { setOnlyUncat(true); setScope("maand"); }}>Toon alleen deze</button>
          </div>
        </div>
      )}

      <div className="card">
        {/* toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--faint)" }}><Ic name="search" size={17} /></span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Zoek op naam of notitie…"
              style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px 9px 36px", fontSize: 14, outline: "none", background: "var(--subtle)" }} />
          </div>
          <div className="seg">
            <button className={scope === "maand" ? "on" : ""} onClick={() => setScope("maand")}>{monthLabelFull(months[monthIdx])}</button>
            <button className={scope === "alle" ? "on" : ""} onClick={() => setScope("alle")}>Alle maanden</button>
          </div>
          <div style={{ position: "relative" }}>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
              style={{ appearance: "none", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 32px 9px 13px", fontSize: 13.5, fontWeight: 600, color: "var(--ink)", background: "#fff", cursor: "pointer" }}>
              <option value="alle">Alle categorieën</option>
              <option value="leeg">Niet ingedeeld</option>
              {D.CATS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--faint)" }}><Ic name="chevronDown" size={16} /></span>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 7, marginLeft: "auto", fontSize: 13, fontWeight: 600, color: "var(--body)", cursor: "pointer" }}>
            <input type="checkbox" checked={onlyUncat} onChange={e => setOnlyUncat(e.target.checked)} style={{ accentColor: "var(--blue)", width: 16, height: 16 }} />
            Alleen niet ingedeeld
          </label>
        </div>

        {/* table */}
        <div style={{ padding: "8px 10px" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ paddingLeft: 14 }}>Transactie</th>
                <th>Datum</th>
                <th>Categorie</th>
                <th style={{ textAlign: "right", paddingRight: 14 }}>Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan="4"><div className="empty">Geen transacties gevonden voor deze filters.</div></td></tr>
              )}
              {rows.map(t => (
                <tr className="row" key={t.id} style={!t.category ? { background: "var(--orange-tint)" } : null}>
                  <td style={{ width: "42%" }}>
                    <div className="merchant">
                      <MerchantAv t={t} />
                      <div>
                        <div className="mn">{t.merchant}</div>
                        {t.note && <div className="md">{t.note}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ color: "var(--muted)", fontWeight: 600 }} className="tnum">{fmtDate(t.date)}</td>
                  <td>
                    {t.category === "inkomen"
                      ? <CatTag catId="inkomen" />
                      : t.category === "sparen"
                        ? <span className="tag" style={{ background: "#F2EFF7", color: "var(--cat-4)" }}><span className="dot" style={{ background: "var(--cat-4)" }}></span>Sparen</span>
                        : <CatSelect value={t.category} onChange={c => updateCat(t.id, c)} />}
                  </td>
                  <td className={"amt tnum " + (t.amount >= 0 ? "pos" : "neg")} style={{ paddingRight: 14 }}>{eurSign(t.amount, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* footer summary */}
        <div style={{ display: "flex", gap: 28, padding: "14px 24px", borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
          <span style={{ color: "var(--muted)" }}>{rows.length} transacties</span>
          <span style={{ marginLeft: "auto", color: "var(--muted)" }}>Inkomsten <b className="tnum" style={{ color: "var(--pos)" }}>{eur(totalIn, 2)}</b></span>
          <span style={{ color: "var(--muted)" }}>Uitgaven <b className="tnum" style={{ color: "var(--ink)" }}>{eur(totalOut, 2)}</b></span>
        </div>
      </div>
    </div>
  );
}

function BudgetsView() {
  const ctx = React.useContext(FAContext);
  const { transactions, months, monthIdx, budgets, setBudget } = ctx;
  const H = window.FAhelpers;
  const key = months[monthIdx].key;
  const monthTxs = H.txInMonth(transactions, key);
  const spend = H.spendByCat(monthTxs);
  const income = H.incomeOf(monthTxs);

  const cats = D.CATS.filter(c => budgets[c.id] != null);
  const totalBudget = cats.reduce((s, c) => s + budgets[c.id], 0);
  const totalSpent = cats.reduce((s, c) => s + (spend[c.id] || 0), 0);
  const toAllocate = income - totalBudget;

  return (
    <div className="content-inner fade-in">
      {/* summary cards */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 18 }}>
        <div className="card card-pad">
          <div className="k-lbl" style={{ marginBottom: 8 }}>Maandinkomen</div>
          <div className="k-val tnum">{eur(income)}</div>
          <div className="k-foot"><span className="delta-note">{monthLabelFull(months[monthIdx])}</span></div>
        </div>
        <div className="card card-pad">
          <div className="k-lbl" style={{ marginBottom: 8 }}>Totaal gebudgetteerd</div>
          <div className="k-val tnum">{eur(totalBudget)}</div>
          <div className="bar" style={{ marginTop: 12 }}><span style={{ width: Math.min(100, totalBudget / income * 100) + "%", background: "var(--blue)" }}></span></div>
        </div>
        <div className="card card-pad" style={{ background: toAllocate >= 0 ? "var(--blue-tint)" : "var(--over-soft)", borderColor: toAllocate >= 0 ? "#DCE6F1" : "#F3D9D5" }}>
          <div className="k-lbl" style={{ marginBottom: 8 }}>{toAllocate >= 0 ? "Vrij te verdelen" : "Boven inkomen"}</div>
          <div className="k-val tnum" style={{ color: toAllocate >= 0 ? "var(--blue)" : "var(--over)" }}>{eurSign(toAllocate)}</div>
          <div className="k-foot"><span className="delta-note">{toAllocate >= 0 ? "ruimte om te sparen of bij te budgetteren" : "verlaag een budget om in balans te komen"}</span></div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="card-h" style={{ marginBottom: 8 }}>
          <h3>Budget per categorie</h3>
          <span className="hint">Versleep om bij te stellen · {monthLabelFull(months[monthIdx])}</span>
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
          {[["#2E7D4F", "tot 70%"], ["#D9772E", "70–85%"], ["#B23B2E", "85% of meer"]].map(([c, l]) => (
            <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
              <span style={{ width: 14, height: 6, borderRadius: 99, background: c }}></span>{l}
            </span>
          ))}
        </div>
        <div>
          {cats.map(c => {
            const spent = spend[c.id] || 0;
            const budget = budgets[c.id];
            const r = budget ? spent / budget : 0;
            const over = spent > budget;
            const col = budgetColor(r);
            return (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: "180px 1fr 150px", alignItems: "center", gap: 22, padding: "16px 0", borderBottom: "1px solid var(--line-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, flex: "none" }}></span>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 14 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: over ? "var(--over)" : "var(--muted)", fontWeight: 600 }}>
                      {over ? `${eur(spent - budget)} over` : `${eur(budget - spent)} resterend`}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="bar" style={{ height: 9 }}><span style={{ width: Math.min(100, r * 100) + "%", background: col }}></span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 12.5 }}>
                    <span className="tnum" style={{ color: "var(--muted)" }}><b style={{ color: "var(--ink)" }}>{eur(spent)}</b> uitgegeven</span>
                    <span className="tnum" style={{ color: over ? "var(--over)" : "var(--muted)", fontWeight: 700 }}>{Math.round(r * 100)}%</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 13, color: "var(--muted)" }}>budget</span>
                    <span className="tnum" style={{ fontWeight: 800, color: "var(--ink)", fontSize: 16, minWidth: 64, textAlign: "right" }}>{eur(budget)}</span>
                  </div>
                  <input type="range" className="rng" min="0" max={Math.max(800, Math.ceil(budget / 100) * 100 * 2)} step="10"
                    value={budget} onChange={e => setBudget(c.id, Number(e.target.value))} />
                </div>
              </div>
            );
          })}
        </div>
        {/* total row */}
        <div style={{ display: "flex", alignItems: "center", padding: "18px 0 4px", gap: 12 }}>
          <span style={{ fontWeight: 800, color: "var(--ink)", fontSize: 15 }}>Totaal</span>
          <span style={{ marginLeft: "auto", fontSize: 13.5, color: "var(--muted)" }} className="tnum"><b style={{ color: "var(--ink)" }}>{eur(totalSpent)}</b> uitgegeven van {eur(totalBudget)} budget</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TransactionsView, BudgetsView });
