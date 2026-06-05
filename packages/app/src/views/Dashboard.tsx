import { useCallback, useMemo, useState } from "react";
import { useApp } from "../state/AppContext";
import { eur, eurSign, fmtDate } from "../lib/format";
import { txInMonths, incomeOf, expensesOf, savingsOf, spendByCat, twelveMonthsEndingAt, monthKeysOfYear, runningTotal } from "../helpers/aggregations";
import { budgetColor } from "../helpers/budgetColor";
import { KpiCard } from "../components/KpiCard";
import { CatTag } from "../components/CatTag";
import { MerchantAv } from "../components/MerchantAv";
import { Ic } from "../components/Ic";
import { Button } from "../components/Button";
import { TrendChart, type TrendSeries } from "../charts/TrendChart";
import { DonutChart } from "../charts/DonutChart";
import { ProgressRing } from "../charts/ProgressRing";
import { useMediaQuery } from "../charts/useMediaQuery";

export function Dashboard() {
  const {
    transactions, budgets, goals, categories, catMap, setView, startBalance, hasImportedBalance, startBalanceKnown,
    periodMode, periodKey, periodYear, periodMonthKeys, periodMonthCount, periodLabel, dataMonthKeys,
  } = useApp();
  const [donutActive, setDonutActive] = useState<number | null>(null);
  const [cumulative, setCumulative] = useState(true);
  const [showBalance, setShowBalance] = useState(true);
  const isPhone = useMediaQuery("(max-width: 560px)");

  // Totalen over een set maand-keys (inkomsten/uitgaven/gespaard).
  const totalsOf = useCallback((keys: string[]) => {
    const txs = txInMonths(transactions, keys);
    return { income: incomeOf(txs, catMap), expense: expensesOf(txs, catMap), saved: savingsOf(txs, catMap) };
  }, [transactions, catMap]);

  // Vorige periode (voor de delta's): vorige maand of vorig jaar.
  const prevKeys = useMemo(() => {
    if (periodMode === "month") {
      const w = twelveMonthsEndingAt(periodKey as string);
      return [w[w.length - 2]];
    }
    const prefix = `${periodYear - 1}-`;
    return dataMonthKeys.filter((k) => k.startsWith(prefix));
  }, [periodMode, periodKey, periodYear, dataMonthKeys]);

  const cur = totalsOf(periodMonthKeys);
  const prev = prevKeys.length ? totalsOf(prevKeys) : null;
  const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);
  const deltaNote = periodMode === "month" ? "vs. vorige maand" : "vs. vorig jaar";

  // Saldo aan het eind van een periode-grens. `end` mag een maand-key ("YYYY-MM") of een
  // dag-key ("YYYY-MM-DD") zijn — de vergelijking volgt de lengte van `end`. Bestaat er een
  // banksaldo in de import, dan pakken we de meest recente transactie t/m die grens (transacties
  // zijn aflopend gesorteerd → eerste match); anders cumulatief vanaf het beginsaldo.
  const hasBalances = useMemo(() => transactions.some((t) => t.balance != null), [transactions]);
  const balanceAt = useCallback(
    (end: string) => {
      // `end` kan in jaar-modus zonder data null zijn; `end.length` wordt daarom alleen
      // binnen de predicaten gelezen (bij een lege transactielijst overgeslagen).
      if (hasBalances) {
        const t = transactions.find((t) => t.date.slice(0, end.length) <= end && t.balance != null);
        if (t) return t.balance as number;
      }
      let b = startBalance;
      transactions.forEach((t) => { if (t.date.slice(0, end.length) <= end) b += t.amount; });
      return b;
    },
    [transactions, hasBalances, startBalance],
  );
  const lastKey = periodMonthKeys[periodMonthKeys.length - 1] ?? (periodKey as string);
  const balance = balanceAt(lastKey);
  const prevBalance = prevKeys.length ? balanceAt(prevKeys[prevKeys.length - 1]) : null;

  // KPI-sparklines: altijd op maand-niveau — 12 maanden t/m de gekozen periode (laatste 6 getoond).
  const sparkKeys = periodMode === "month" ? twelveMonthsEndingAt(periodKey as string) : monthKeysOfYear(periodYear);
  const sparkSeries = useMemo(
    () => sparkKeys.map((mk) => {
      const txs = txInMonths(transactions, [mk]);
      return { income: incomeOf(txs, catMap), expense: expensesOf(txs, catMap), saved: savingsOf(txs, catMap) };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, catMap, sparkKeys.join(",")],
  );

  // Trend "Inkomsten & uitgaven": in maand-modus het dag-verloop (alle dagen van de gekozen
  // maand), in jaar-modus het maand-verloop (jan–dec). Maanden tonen we dus alleen bij "Heel jaar".
  const isDaily = periodMode === "month";
  const trendKeys = useMemo(() => {
    // Jaar-modus: alleen de maanden mét data tonen (geen gat voor de rest van het jaar).
    if (!isDaily) return periodMonthKeys;
    const mk = periodKey as string;
    const [yy, mm] = mk.split("-").map(Number);
    const days = new Date(yy, mm, 0).getDate();
    return Array.from({ length: days }, (_, i) => `${mk}-${String(i + 1).padStart(2, "0")}`);
  }, [isDaily, periodKey, periodMonthKeys]);
  const series = useMemo(
    () => trendKeys.map((k) => {
      const txs = isDaily ? transactions.filter((t) => t.date.slice(0, 10) === k) : txInMonths(transactions, [k]);
      return { key: k, income: incomeOf(txs, catMap), expense: expensesOf(txs, catMap), saved: savingsOf(txs, catMap) };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, catMap, trendKeys.join(","), isDaily],
  );

  const periodTxs = txInMonths(transactions, periodMonthKeys);
  const spend = spendByCat(periodTxs, catMap); // per leaf-categorie
  const donutData = categories
    .filter((c) => c.type === "uitgave" && spend[c.id])
    .map((c) => ({ label: c.name, value: spend[c.id], color: c.color, id: c.id }))
    .sort((a, b) => b.value - a.value);
  const totalSpend = donutData.reduce((s, d) => s + d.value, 0) || 1;

  const last6 = (sel: (s: typeof sparkSeries[number]) => number) => sparkSeries.slice(-6).map(sel);

  const MONTH_ABBR = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  // Cumulatief: inkomsten/uitgaven oplopend optellen over de getoonde periode (reset per maand
  // in dagweergave, per jaar in jaarweergave). Saldo is al een lopend saldo en blijft ongemoeid.
  const incData = cumulative ? runningTotal(series.map((s) => s.income)) : series.map((s) => s.income);
  const expData = cumulative ? runningTotal(series.map((s) => s.expense)) : series.map((s) => s.expense);
  const balanceData = trendKeys.map(balanceAt);
  const trendSeries: TrendSeries[] = [
    { key: "inkomen", name: "Inkomsten", color: "var(--blue)", data: incData, axis: "left" },
    { key: "uitgaven", name: "Uitgaven", color: "var(--orange)", data: expData, axis: "left" },
    // Saldo: bij cumulatief op dezelfde as (vergelijkbare grootte), anders op een eigen rechter-as.
    ...(showBalance
      ? [{ key: "saldo", name: "Saldo", color: "var(--pos)", data: balanceData, noArea: true, axis: cumulative ? "left" as const : "right" as const }]
      : []),
  ];

  // X-as: dagnummers binnen de maand, of maanden over het jaar (op desktop met jaartal).
  const trendLabels = isDaily
    ? trendKeys.map((k) => String(Number(k.slice(8, 10))))
    : isPhone
      ? trendKeys.map((mk) => MONTH_ABBR[+mk.split("-")[1] - 1])
      : trendKeys.map((mk) => { const [y, m] = mk.split("-"); return `${MONTH_ABBR[+m - 1]} '${y.slice(2)}`; });
  // Tooltip-kop: bij dagen de volledige datum (bv. "12 mei"), anders gelijk aan de x-as.
  const trendTipLabels = isDaily
    ? trendKeys.map((k) => `${Number(k.slice(8, 10))} ${MONTH_ABBR[+k.slice(5, 7) - 1]}`)
    : undefined;
  const trendSeriesView = trendSeries;

  const budgetRows = categories
    .filter((c) => budgets[c.id])
    .map((c) => ({ c, spent: spend[c.id] || 0, budget: budgets[c.id] * periodMonthCount }))
    .sort((a, b) => b.spent / b.budget - a.spent / a.budget)
    .slice(0, 5);

  const recent = periodTxs.slice(0, 6);
  const goal = goals[0];

  return (
    <div className="content-inner fade-in">
      {transactions.length === 0 && (
        <div className="notice" style={{ marginBottom: 18, background: "var(--blue-soft)", borderColor: "#CFE0F2" }}>
          <span className="ni" style={{ color: "var(--blue)" }}><Ic name="info" size={20} /></span>
          <div className="nt" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span><b>Nog geen gegevens.</b> Importeer je transacties om je overzicht, budgetten en spaardoelen te vullen.</span>
            <Button variant="primary" icon="upload" onClick={() => setView("import")}>Importeren</Button>
          </div>
        </div>
      )}
      {transactions.length > 0 && !hasImportedBalance && !startBalanceKnown && (
        <div className="notice" style={{ marginBottom: 18, background: "var(--orange-soft)", borderColor: "var(--orange)" }}>
          <span className="ni" style={{ color: "var(--orange)" }}><Ic name="info" size={20} /></span>
          <div className="nt" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span><b>Beginsaldo ontbreekt.</b> Vul je startsaldo in zodat het saldo-overzicht klopt — je import levert (nog) geen banksaldo mee.</span>
            <Button variant="primary" onClick={() => setView("profiel", "beginsaldo")}>Beginsaldo invullen</Button>
          </div>
        </div>
      )}
      <div className="grid stagger grid-kpi" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 18 }}>
        <KpiCard icon="wallet" iconColor="var(--blue)" iconBg="var(--blue-soft)" phone={isPhone}
          label="Saldo betaalrekening" value={eur(balance)} delta={prevBalance ? pct(balance, prevBalance) : null}
          deltaNote={deltaNote} spark={last6((s) => s.income - s.expense)} sparkColor="var(--blue)" />
        <KpiCard icon="arrowDown" iconColor="var(--pos)" iconBg="var(--pos-soft)" phone={isPhone}
          label="Inkomsten" value={eur(cur.income)} delta={prev ? pct(cur.income, prev.income) : null}
          deltaNote={deltaNote} spark={last6((s) => s.income)} sparkColor="var(--pos)" />
        <KpiCard icon="arrowUp" iconColor="var(--orange)" iconBg="var(--orange-soft)" phone={isPhone}
          label="Uitgaven" value={eur(cur.expense)} delta={prev ? pct(cur.expense, prev.expense) : null}
          deltaNote={deltaNote} spark={last6((s) => s.expense)} sparkColor="var(--orange)" />
        <KpiCard icon="piggy" iconColor="var(--cat-4)" iconBg="#F2EFF7" phone={isPhone}
          label="Gespaard" value={eur(cur.saved)} delta={prev ? pct(cur.saved, prev.saved) : null}
          deltaNote="naar spaardoel" spark={last6((s) => s.saved)} sparkColor="var(--cat-4)" />
      </div>

      <div className="grid grid-2to1" style={{ gridTemplateColumns: "1.62fr 1fr", marginBottom: 18 }}>
        <div className="card card-pad">
          <div className="card-h">
            <h3>Inkomsten &amp; uitgaven</h3>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <div className="seg">
                <button className={cumulative ? "on" : ""} aria-pressed={cumulative} onClick={() => setCumulative((v) => !v)}>Cumulatief</button>
              </div>
              <div className="seg">
                <button className={showBalance ? "on" : ""} aria-pressed={showBalance} onClick={() => setShowBalance((v) => !v)}>Saldo</button>
              </div>
            </div>
          </div>
          <div className="trend-legend" style={{ display: "flex", gap: 18, margin: "4px 0 10px" }}>
            {trendSeries.map((s) => (
              <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--body)" }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color }}></span>{s.name}
              </span>
            ))}
          </div>
          <TrendChart series={trendSeriesView} labels={trendLabels} tipLabels={trendTipLabels} height={isPhone ? 200 : 262} />
        </div>

        <div className="card card-pad">
          <div className="card-h"><h3>Uitgaven per categorie</h3></div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>{periodLabel}</div>
          <div className="cat-body">
            <div className="ring-wrap" style={{ flex: "none" }}>
              <DonutChart data={donutData} size={isPhone ? 190 : 158} thickness={22} active={donutActive} onHover={setDonutActive} />
              <div className="ring-center">
                <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>
                  {donutActive != null ? donutData[donutActive].label : "Totaal"}
                </div>
                <div className="tnum" style={{ fontSize: 19, fontWeight: 800, color: "var(--ink)" }}>
                  {eur(donutActive != null ? donutData[donutActive].value : totalSpend)}
                </div>
              </div>
            </div>
            {isPhone ? (
              <div className="legend-2col">
                {donutData.slice(0, 6).map((d, i) => (
                  <div className="legend-cell" key={d.id}
                    onMouseEnter={() => setDonutActive(i)} onMouseLeave={() => setDonutActive(null)}
                    style={{ background: donutActive === i ? "var(--subtle)" : "transparent" }}>
                    <div className="lc-top"><span className="d" style={{ background: d.color }}></span><span className="ln">{d.label}</span></div>
                    <div className="lc-sub tnum">{eur(d.value)} · {Math.round((d.value / totalSpend) * 100)}%</div>
                  </div>
                ))}
              </div>
            ) : (
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
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-2to1" style={{ gridTemplateColumns: "1.62fr 1fr" }}>
        <div className="card card-pad">
          <div className="card-h">
            <h3>Budgetstatus</h3>
            <Button variant="ghost" style={{ marginLeft: "auto", padding: "5px 10px" }} onClick={() => setView("budgetten")}>
              Alle budgetten <Ic name="chevronRight" size={15} />
            </Button>
          </div>
          <div style={{ marginTop: 4 }}>
            {budgetRows.map(({ c, spent, budget }) => {
              const r = spent / budget;
              return (
                <div className="bud" key={c.id}>
                  <div className="bud-top">
                    <span className="dot" style={{ width: 9, height: 9, borderRadius: "50%", background: c.color }}></span>
                    <span className="bud-name">{c.name}</span>
                    <span className="bud-fig tnum"><b>{eur(spent)}</b> / {eur(budget)}</span>
                  </div>
                  <div className="bar"><span style={{ width: Math.min(100, r * 100) + "%", background: budgetColor(r) }}></span></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card card-pad" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-h"><h3>Spaardoel</h3>
            <Button variant="ghost" style={{ marginLeft: "auto", padding: "5px 10px" }} onClick={() => setView("spaardoel")}>
              Details <Ic name="chevronRight" size={15} />
            </Button>
          </div>
          {goal ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "8px 0 4px" }}>
              <div className="ring-wrap">
                <ProgressRing value={goal.current} max={goal.target} size={isPhone ? 124 : 150} thickness={14} color="var(--blue)" />
                <div className="ring-center">
                  <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>{Math.round((goal.current / goal.target) * 100)}%</div>
                  <div className="tnum" style={{ fontSize: 21, fontWeight: 800, color: "var(--ink)" }}>{eur(goal.current)}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>van {eur(goal.target)}</div>
                </div>
              </div>
              <div style={{ marginTop: 16, textAlign: "center" }}>
                <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 14.5 }}>{goal.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                  Nog {eur(Math.max(0, goal.target - goal.current))} te gaan
                </div>
              </div>
            </div>
          ) : (
            <div className="empty">Nog geen spaardoel. Maak er een aan bij Spaardoelen.</div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-pad" style={{ paddingBottom: 4 }}>
          <div className="card-h">
            <h3>Recente transacties</h3>
            <Button variant="ghost" style={{ marginLeft: "auto", padding: "5px 10px" }} onClick={() => setView("transacties")}>
              Alle transacties <Ic name="chevronRight" size={15} />
            </Button>
          </div>
        </div>
        <div style={{ padding: "0 10px 8px" }}>
          <table className="tbl tbl-cards">
            <tbody>
              {recent.map((t) => (
                <tr className="row" key={t.id}>
                  <td className="td-primary" style={{ width: "50%" }}>
                    <div className="merchant">
                      <MerchantAv t={t} />
                      <div>
                        <div className="mn">{t.merchant}</div>
                        <div className="md">{fmtDate(t.date)}{t.note ? " · " + t.note : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Categorie"><CatTag catId={t.category} small /></td>
                  <td className={"amt tnum " + (t.amount >= 0 ? "pos" : "neg")} data-label="Bedrag">{eurSign(t.amount, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
