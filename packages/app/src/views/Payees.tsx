import { useMemo, useState } from "react";
import { useApp } from "../state/AppContext";
import { eurSign, fmtDate } from "../lib/format";
import { buildPayeeOverview } from "../helpers/payees";
import { assignPayeeCategory } from "../db/repo";
import { CatSelect } from "../components/CatSelect";
import { Ic } from "../components/Ic";

type SortKey = "count" | "amount" | "name";

export function Payees() {
  const { transactions, payeeMap, catMap } = useApp();
  const [q, setQ] = useState("");
  const [onlyUncat, setOnlyUncat] = useState(false);
  const [sort, setSort] = useState<SortKey>("count");

  const overview = useMemo(() => buildPayeeOverview(transactions, payeeMap), [transactions, payeeMap]);

  let rows = overview;
  if (q.trim()) {
    const s = q.toLowerCase();
    rows = rows.filter((p) => p.name.toLowerCase().includes(s) || p.iban.toLowerCase().includes(s));
  }
  if (onlyUncat) rows = rows.filter((p) => !p.categoryId);
  rows = [...rows].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, "nl");
    if (sort === "amount") return Math.abs(b.total) - Math.abs(a.total);
    return b.count - a.count;
  });

  const uncatCount = overview.filter((p) => !p.categoryId).length;

  return (
    <div className="content-inner fade-in">
      {uncatCount > 0 && (
        <div className="notice" style={{ marginBottom: 18 }}>
          <span className="ni"><Ic name="info" size={20} /></span>
          <div className="nt">
            <b>{uncatCount} tegenpartij{uncatCount === 1 ? "" : "en"} nog niet ingedeeld.</b> Wijs hier één keer een categorie toe — alle transacties van die tegenpartij (nu én bij toekomstige imports) krijgen die categorie automatisch.
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 340 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--faint)" }}><Ic name="search" size={17} /></span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek op naam of IBAN…"
              style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px 9px 36px", fontSize: 14, outline: "none", background: "var(--subtle)" }} />
          </div>
          <div className="seg">
            <button className={sort === "count" ? "on" : ""} onClick={() => setSort("count")}>Aantal</button>
            <button className={sort === "amount" ? "on" : ""} onClick={() => setSort("amount")}>Bedrag</button>
            <button className={sort === "name" ? "on" : ""} onClick={() => setSort("name")}>Naam</button>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 7, marginLeft: "auto", fontSize: 13, fontWeight: 600, color: "var(--body)", cursor: "pointer" }}>
            <input type="checkbox" checked={onlyUncat} onChange={(e) => setOnlyUncat(e.target.checked)} style={{ accentColor: "var(--blue)", width: 16, height: 16 }} />
            Alleen zonder categorie
          </label>
        </div>

        <div style={{ padding: "8px 10px" }}>
          <table className="tbl tbl-cards">
            <thead>
              <tr>
                <th style={{ paddingLeft: 14 }}>Tegenpartij</th>
                <th style={{ textAlign: "right" }}>Transacties</th>
                <th style={{ textAlign: "right" }}>Totaal</th>
                <th>Laatste</th>
                <th>Categorie</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5}><div className="empty">Geen tegenpartijen gevonden.</div></td></tr>
              )}
              {rows.map((p) => {
                const c = catMap[p.categoryId];
                return (
                  <tr className="row" key={p.key} style={!p.categoryId ? { background: "var(--orange-tint)" } : undefined}>
                    <td className="td-primary" style={{ width: "40%" }}>
                      <div className="merchant">
                        <span className="mi" style={{ background: c ? c.tint : "var(--subtle)", color: c ? c.color : "var(--muted)" }}>
                          {(p.name[0] || "?").toUpperCase()}
                        </span>
                        <div>
                          <div className="mn">{p.name}</div>
                          <div className="md" style={{ fontFamily: p.iban ? "monospace" : undefined, fontSize: 11.5 }}>
                            {p.iban || "Pinbetaling — geen IBAN"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="tnum" style={{ textAlign: "right", color: "var(--muted)", fontWeight: 600 }} data-label="Transacties">{p.count}</td>
                    <td className={"amt tnum " + (p.total >= 0 ? "pos" : "neg")} style={{ textAlign: "right" }} data-label="Totaal">{eurSign(p.total, 2)}</td>
                    <td className="tnum" style={{ color: "var(--muted)", fontWeight: 600 }} data-label="Laatste">{fmtDate(p.lastDate)}</td>
                    <td data-label="Categorie">
                      <CatSelect value={p.categoryId} includeIncome onChange={(cat) => assignPayeeCategory({ counterIban: p.iban, merchant: p.name }, cat)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="tbl-foot" style={{ display: "flex", gap: 28, padding: "14px 24px", borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
          <span style={{ color: "var(--muted)" }}>{rows.length} tegenpartijen</span>
          {uncatCount > 0 && <span style={{ marginLeft: "auto", color: "var(--muted)" }}>{uncatCount} zonder categorie</span>}
        </div>
      </div>
    </div>
  );
}
