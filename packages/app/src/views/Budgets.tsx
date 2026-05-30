import { useApp } from "../state/AppContext";
import { eur, eurSign, monthKeyLabelFull } from "../lib/format";
import { txInMonth, incomeOf, spendByCat } from "../helpers/aggregations";
import { budgetColor } from "../helpers/budgetColor";
import { setRecurringBudget } from "../db/repo";
import type { Category } from "../db/types";

export function Budgets() {
  const { transactions, months, monthIdx, budgets, categories, catMap } = useApp();
  const key = months[monthIdx];
  const monthTxs = txInMonth(transactions, key);
  const spend = spendByCat(monthTxs, catMap);
  const income = incomeOf(monthTxs, catMap);

  const byName = (a: Category, b: Category) => a.name.localeCompare(b.name, "nl");
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id).sort(byName);
  const topLevel = categories.filter((c) => !c.parentId && c.type === "uitgave").sort(byName);
  // budgetteerbaar = uitgave-categorie zonder kinderen (leaf)
  const leaves = categories.filter((c) => c.type === "uitgave" && childrenOf(c.id).length === 0);
  const totalBudget = leaves.reduce((s, c) => s + (budgets[c.id] || 0), 0);
  const totalSpent = leaves.reduce((s, c) => s + (spend[c.id] || 0), 0);
  const toAllocate = income - totalBudget;

  function LeafRow({ c, indent }: { c: Category; indent?: boolean }) {
    const spent = spend[c.id] || 0;
    const budget = budgets[c.id] || 0;
    const r = budget ? spent / budget : 0;
    const over = budget > 0 && spent > budget;
    return (
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 150px", alignItems: "center", gap: 22, padding: "14px 0", paddingLeft: indent ? 18 : 0, borderBottom: "1px solid var(--line-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, flex: "none" }}></span>
          <div>
            <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 14 }}>{c.name}</div>
            <div style={{ fontSize: 12, color: over ? "var(--over)" : "var(--muted)", fontWeight: 600 }}>
              {budget === 0 ? "geen budget" : over ? `${eur(spent - budget)} over` : `${eur(budget - spent)} resterend`}
            </div>
          </div>
        </div>
        <div>
          <div className="bar" style={{ height: 9 }}><span style={{ width: Math.min(100, r * 100) + "%", background: budgetColor(r) }}></span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 12.5 }}>
            <span className="tnum" style={{ color: "var(--muted)" }}><b style={{ color: "var(--ink)" }}>{eur(spent)}</b> uitgegeven</span>
            <span className="tnum" style={{ color: over ? "var(--over)" : "var(--muted)", fontWeight: 700 }}>{budget ? Math.round(r * 100) + "%" : "—"}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, justifyContent: "flex-end" }}>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>budget</span>
            <span className="tnum" style={{ fontWeight: 800, color: "var(--ink)", fontSize: 16, minWidth: 64, textAlign: "right" }}>{eur(budget)}</span>
          </div>
          <input type="range" className="rng" min={0} max={Math.max(800, Math.ceil(budget / 100) * 100 * 2)} step={10}
            value={budget} onChange={(e) => setRecurringBudget(c.id, Number(e.target.value))} />
        </div>
      </div>
    );
  }

  function GroupHeader({ g }: { g: Category }) {
    const kids = childrenOf(g.id);
    const b = kids.reduce((s, k) => s + (budgets[k.id] || 0), 0);
    const sp = kids.reduce((s, k) => s + (spend[k.id] || 0), 0);
    const r = b ? sp / b : 0;
    return (
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 150px", alignItems: "center", gap: 22, padding: "16px 0 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: g.color, flex: "none" }}></span>
          <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 14.5 }}>{g.name}</div>
        </div>
        <div className="bar" style={{ height: 7 }}><span style={{ width: Math.min(100, r * 100) + "%", background: budgetColor(r) }}></span></div>
        <div className="tnum" style={{ textAlign: "right", fontSize: 13, color: "var(--muted)" }}><b style={{ color: "var(--ink)" }}>{eur(sp)}</b> / {eur(b)}</div>
      </div>
    );
  }

  return (
    <div className="content-inner fade-in">
      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 18 }}>
        <div className="card card-pad">
          <div className="k-lbl" style={{ marginBottom: 8 }}>Maandinkomen</div>
          <div className="k-val tnum">{eur(income)}</div>
          <div className="k-foot"><span className="delta-note">{monthKeyLabelFull(key)}</span></div>
        </div>
        <div className="card card-pad">
          <div className="k-lbl" style={{ marginBottom: 8 }}>Totaal gebudgetteerd</div>
          <div className="k-val tnum">{eur(totalBudget)}</div>
          <div className="bar" style={{ marginTop: 12 }}><span style={{ width: Math.min(100, income ? (totalBudget / income) * 100 : 0) + "%", background: "var(--blue)" }}></span></div>
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
          <span className="hint">Versleep om bij te stellen · {monthKeyLabelFull(key)}</span>
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 6, flexWrap: "wrap" }}>
          {([["#2E7D4F", "tot 70%"], ["#D9772E", "70–85%"], ["#B23B2E", "85% of meer"]] as const).map(([c, l]) => (
            <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
              <span style={{ width: 14, height: 6, borderRadius: 99, background: c }}></span>{l}
            </span>
          ))}
        </div>
        <div>
          {topLevel.map((top) => {
            const kids = childrenOf(top.id);
            if (kids.length === 0) return <LeafRow key={top.id} c={top} />;
            return (
              <div key={top.id}>
                <GroupHeader g={top} />
                {kids.map((k) => <LeafRow key={k.id} c={k} indent />)}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", padding: "18px 0 4px", gap: 12 }}>
          <span style={{ fontWeight: 800, color: "var(--ink)", fontSize: 15 }}>Totaal</span>
          <span style={{ marginLeft: "auto", fontSize: 13.5, color: "var(--muted)" }} className="tnum"><b style={{ color: "var(--ink)" }}>{eur(totalSpent)}</b> uitgegeven van {eur(totalBudget)} budget</span>
        </div>
      </div>
    </div>
  );
}
