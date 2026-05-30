/* FinanceApp — shared UI components, context, and aggregation helpers */

const FAContext = React.createContext(null);
window.FAContext = FAContext;

/* ── helpers ── */
const D = window.FA_DATA;
function monthLabelFull(mo) { return `${D.MONTHS_NL[mo.m]} ${mo.y}`; }
function monthLabelShort(mo) { return `${D.MONTHS_SH[mo.m]} '${String(mo.y).slice(2)}`; }
function txKey(t) { return t.date.slice(0, 7); }
function fmtDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${D.MONTHS_SH[m - 1]}`;
}

// transactions in a given month key
function txInMonth(txs, key) { return txs.filter(t => txKey(t) === key); }
// income (positive inkomen)
function incomeOf(txs) { return txs.filter(t => t.category === "inkomen").reduce((s, t) => s + t.amount, 0); }
// real expenses: negatives excluding sparen + inkomen
function expensesOf(txs) {
  return txs.filter(t => t.amount < 0 && t.category !== "sparen").reduce((s, t) => s + Math.abs(t.amount), 0);
}
function savingsOf(txs) { return txs.filter(t => t.category === "sparen").reduce((s, t) => s + Math.abs(t.amount), 0); }
// spend per category (object id->amount), excluding sparen/inkomen, only negatives
function spendByCat(txs) {
  const out = {};
  txs.forEach(t => {
    if (t.amount < 0 && t.category && t.category !== "sparen") {
      out[t.category] = (out[t.category] || 0) + Math.abs(t.amount);
    }
  });
  return out;
}

window.FAhelpers = { monthLabelFull, monthLabelShort, txKey, fmtDate, txInMonth, incomeOf, expensesOf, savingsOf, spendByCat };

/* ── budget color scale (ratio spent/budget → fill color) ──
 *  0–70%  : light green  → dark green
 *  70–85% : light orange → dark orange
 *  85–100%: light red    → dark red
 *  ≥100%  : stays dark red (the 100% color) */
const BUD_STOPS = {
  greenLo:  [127, 185, 142], greenHi:  [46, 125, 79],   // #7FB98E → #2E7D4F
  orangeLo: [233, 169, 113], orangeHi: [217, 119, 46],  // #E9A971 → #D9772E
  redLo:    [222, 138, 130], redHi:    [178, 59, 46],   // #DE8A82 → #B23B2E
};
function _lerp(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
function budgetColor(r) {
  if (r <= 0.70) return _lerp(BUD_STOPS.greenLo, BUD_STOPS.greenHi, r / 0.70);
  if (r <= 0.85) return _lerp(BUD_STOPS.orangeLo, BUD_STOPS.orangeHi, (r - 0.70) / 0.15);
  if (r < 1.00)  return _lerp(BUD_STOPS.redLo, BUD_STOPS.redHi, (r - 0.85) / 0.15);
  return _lerp(BUD_STOPS.redLo, BUD_STOPS.redHi, 1); // ≥100% → dark red
}
window.budgetColor = budgetColor;

/* ── savings allocation: cascade a category's balance into its goals by priority ── */
function allocateGoals(group) {
  let rem = group.balance;
  const ordered = group.goals.slice().sort((a, b) => a.priority - b.priority);
  const rows = ordered.map(g => {
    const filled = Math.max(0, Math.min(rem, g.target));
    rem -= filled;
    return { ...g, filled, done: filled >= g.target - 0.5, pct: g.target ? filled / g.target : 0 };
  });
  const activeIdx = rows.findIndex(r => !r.done);
  return { rows, activeIdx: activeIdx === -1 ? rows.length - 1 : activeIdx, allDone: activeIdx === -1 };
}
window.allocateGoals = allocateGoals;

/* ── Sidebar ── */
function Sidebar({ view, setView, uncategorizedCount }) {
  const items = [
    { id: "dashboard", label: "Overzicht", icon: "dashboard" },
    { id: "transacties", label: "Transacties", icon: "list", badge: uncategorizedCount || 0 },
    { id: "budgetten", label: "Budgetten", icon: "sliders" },
    { id: "spaardoel", label: "Spaardoelen", icon: "target" },
  ];
  return (
    <aside className="sb">
      <div className="sb-brand">
        <span className="wm">FinanceApp</span>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map(it => (
          <button key={it.id} className={"nav-item" + (view === it.id ? " active" : "")} onClick={() => setView(it.id)}>
            <Ic name={it.icon} />
            <span>{it.label}</span>
            {it.badge ? <span className="nav-badge">{it.badge}</span> : null}
          </button>
        ))}
      </nav>

      <div className="sb-sec">Data</div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <button className={"nav-item" + (view === "import" ? " active" : "")} onClick={() => setView("import")}>
          <Ic name="upload" />
          <span>Importeren</span>
        </button>
      </nav>

      <div className="sb-foot">
        <div className="sb-user">
          <div className="av">SJ</div>
          <div>
            <div className="nm">Sanne Jansen</div>
            <div className="em">sanne@huishouden.nl</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ── Month picker ── */
function MonthPicker() {
  const { months, monthIdx, setMonthIdx } = React.useContext(FAContext);
  const mo = months[monthIdx];
  return (
    <div className="month-pick">
      <button onClick={() => setMonthIdx(Math.max(0, monthIdx - 1))} disabled={monthIdx === 0} aria-label="Vorige maand">
        <Ic name="chevronLeft" size={18} />
      </button>
      <span className="lbl tnum">{monthLabelFull(mo)}</span>
      <button onClick={() => setMonthIdx(Math.min(months.length - 1, monthIdx + 1))} disabled={monthIdx === months.length - 1} aria-label="Volgende maand">
        <Ic name="chevronRight" size={18} />
      </button>
    </div>
  );
}

/* ── category tag ── */
function CatTag({ catId, small }) {
  const c = D.CAT[catId];
  if (!c) return <span className="tag" style={{ background: "var(--orange-soft)", color: "var(--orange)" }}>
    <span className="dot" style={{ background: "var(--orange)" }}></span>Niet ingedeeld</span>;
  return (
    <span className="tag" style={{ background: c.tint, color: c.color, padding: small ? "3px 9px" : undefined }}>
      <span className="dot" style={{ background: c.color }}></span>{c.name}
    </span>
  );
}

/* ── editable category selector (for categorising) ── */
function CatSelect({ value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const opts = D.CATS.filter(c => c.id !== "inkomen");
  return (
    <div className="cat-select" ref={ref}>
      <button style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <CatTag catId={value} />
          <Ic name="chevronDown" size={14} style={{ color: "var(--faint)" }} />
        </span>
      </button>
      {open && (
        <div className="cat-menu scroll">
          {opts.map(c => (
            <button key={c.id} className={"cat-opt" + (value === c.id ? " sel" : "")} onClick={() => { onChange(c.id); setOpen(false); }}>
              <span className="dot" style={{ background: c.color }}></span>{c.name}
              {value === c.id && <span className="ck"><Ic name="check" size={15} /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── KPI card ── */
function KpiCard({ icon, iconColor, iconBg, label, value, delta, deltaNote, spark, sparkColor }) {
  return (
    <div className="card kpi">
      <div className="k-top">
        <span className="k-ic" style={{ background: iconBg, color: iconColor }}><Ic name={icon} /></span>
        <span className="k-lbl">{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <div className="k-val tnum">{value}</div>
        {spark && <Spark data={spark} color={sparkColor} />}
      </div>
      {delta != null && (
        <div className="k-foot">
          <span className={"delta " + (delta >= 0 ? "up" : "down")}>
            <Ic name={delta >= 0 ? "arrowUp" : "arrowDown"} size={13} />
            {Math.abs(delta).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}%
          </span>
          <span className="delta-note">{deltaNote}</span>
        </div>
      )}
    </div>
  );
}

/* ── merchant avatar (initial in tinted square) ── */
function MerchantAv({ t }) {
  const c = D.CAT[t.category] || { color: "var(--muted)", tint: "var(--subtle)", initial: t.merchant[0] };
  return <span className="mi" style={{ background: c.tint, color: c.color }}>{(t.merchant[0] || "?").toUpperCase()}</span>;
}

Object.assign(window, { Sidebar, MonthPicker, CatTag, CatSelect, KpiCard, MerchantAv });
