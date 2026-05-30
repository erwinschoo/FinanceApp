import { useState } from "react";
import { useApp } from "../state/AppContext";
import { eur, eurSign, fmtDate, monthKeyLabelFull } from "../lib/format";
import { txKey } from "../helpers/aggregations";
import { assignPayeeCategory } from "../db/repo";
import { CatTag } from "../components/CatTag";
import { CatSelect } from "../components/CatSelect";
import { MerchantAv } from "../components/MerchantAv";
import { Ic } from "../components/Ic";

export function Transactions() {
  const { transactions, months, monthIdx, categories } = useApp();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"maand" | "alle">("maand");
  const [catFilter, setCatFilter] = useState("alle");
  const [onlyUncat, setOnlyUncat] = useState(false);

  const key = months[monthIdx];
  let rows = transactions;
  if (scope === "maand") rows = rows.filter((t) => txKey(t) === key);
  if (catFilter !== "alle") rows = rows.filter((t) => (catFilter === "leeg" ? !t.category : t.category === catFilter));
  if (onlyUncat) rows = rows.filter((t) => !t.category);
  if (q.trim()) {
    const s = q.toLowerCase();
    rows = rows.filter((t) => t.merchant.toLowerCase().includes(s) || (t.note || "").toLowerCase().includes(s) || t.rawDescription.toLowerCase().includes(s));
  }

  const uncatCount = transactions.filter((t) => !t.category && txKey(t) === key).length;
  const totalOut = rows.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalIn = rows.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);

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
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--faint)" }}><Ic name="search" size={17} /></span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek op naam of notitie…"
              style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px 9px 36px", fontSize: 14, outline: "none", background: "var(--subtle)" }} />
          </div>
          <div className="seg">
            <button className={scope === "maand" ? "on" : ""} onClick={() => setScope("maand")}>{monthKeyLabelFull(key)}</button>
            <button className={scope === "alle" ? "on" : ""} onClick={() => setScope("alle")}>Alle maanden</button>
          </div>
          <div style={{ position: "relative" }}>
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
              style={{ appearance: "none", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 32px 9px 13px", fontSize: 13.5, fontWeight: 600, color: "var(--ink)", background: "#fff", cursor: "pointer" }}>
              <option value="alle">Alle categorieën</option>
              <option value="leeg">Niet ingedeeld</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--faint)" }}><Ic name="chevronDown" size={16} /></span>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 7, marginLeft: "auto", fontSize: 13, fontWeight: 600, color: "var(--body)", cursor: "pointer" }}>
            <input type="checkbox" checked={onlyUncat} onChange={(e) => setOnlyUncat(e.target.checked)} style={{ accentColor: "var(--blue)", width: 16, height: 16 }} />
            Alleen niet ingedeeld
          </label>
        </div>

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
                <tr><td colSpan={4}><div className="empty">Geen transacties gevonden voor deze filters.</div></td></tr>
              )}
              {rows.map((t) => (
                <tr className="row" key={t.id} style={!t.category ? { background: "var(--orange-tint)" } : undefined}>
                  <td style={{ width: "42%" }}>
                    <div className="merchant">
                      <MerchantAv t={t} />
                      <div>
                        <div className="mn">{t.merchant}</div>
                        {t.note ? <div className="md">{t.note}</div> : <div className="md" style={{ fontFamily: "monospace", fontSize: 11, color: "var(--faint)" }}>{t.rawDescription.slice(0, 48)}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ color: "var(--muted)", fontWeight: 600 }} className="tnum">{fmtDate(t.date)}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {t.category === "inkomen" ? (
                        <CatTag catId="inkomen" />
                      ) : t.category === "sparen" ? (
                        <CatTag catId="sparen" />
                      ) : (
                        <CatSelect
                          value={t.category}
                          onChange={(c) => assignPayeeCategory({ counterIban: t.counterIban, merchant: t.merchant }, c)}
                        />
                      )}
                    </div>
                  </td>
                  <td className={"amt tnum " + (t.amount >= 0 ? "pos" : "neg")} style={{ paddingRight: 14 }}>{eurSign(t.amount, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 28, padding: "14px 24px", borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
          <span style={{ color: "var(--muted)" }}>{rows.length} transacties</span>
          <span style={{ marginLeft: "auto", color: "var(--muted)" }}>Inkomsten <b className="tnum" style={{ color: "var(--pos)" }}>{eur(totalIn, 2)}</b></span>
          <span style={{ color: "var(--muted)" }}>Uitgaven <b className="tnum" style={{ color: "var(--ink)" }}>{eur(totalOut, 2)}</b></span>
        </div>
      </div>
    </div>
  );
}
