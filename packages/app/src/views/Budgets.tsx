import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../state/AppContext";
import { useProfile, DEFAULT_PROFILE } from "../state/profile";
import { eur, eurSign } from "../lib/format";
import { txInMonths, incomeOf, spendByCat } from "../helpers/aggregations";
import { budgetColor } from "../helpers/budgetColor";
import { postForCategory } from "../nibud/mapping";
import { NIBUD_HOUSEHOLDS, matchHousehold, compositionFrom } from "../nibud/referenceData";
import { setRecurringBudget } from "../db/repo";
import type { Category, CategoryGroupRow } from "../db/types";

export function Budgets() {
  const { transactions, budgets, categories, categoryGroups, catMap, periodMode, periodMonthKeys, periodMonthCount, periodLabel } = useApp();
  const profile = useProfile();
  const periodTxs = txInMonths(transactions, periodMonthKeys);
  const spend = spendByCat(periodTxs, catMap);
  const income = incomeOf(periodTxs, catMap);
  // Budgetten zijn maandbedragen; over de periode vergelijken we met budget × aantal maanden.
  const n = periodMonthCount;

  // Actief Nibud-voorbeeldhuishouden (defaults wanneer nog geen profiel opgeslagen),
  // zodat we per categorie een indicatieve referentiewaarde op de slider tonen.
  const household = useMemo(() => {
    const pf = profile ?? DEFAULT_PROFILE;
    if (pf.nibudHouseholdId) {
      const chosen = NIBUD_HOUSEHOLDS.find((h) => h.id === pf.nibudHouseholdId);
      if (chosen) return chosen;
    }
    return matchHousehold(compositionFrom(pf.adults, pf.children), pf.incomeBand);
  }, [profile]);
  const referenceFor = (catId: string): number | null => {
    const post = postForCategory(catId, profile ?? DEFAULT_PROFILE);
    return post ? household.posts[post] ?? null : null;
  };

  const byName = (a: Category, b: Category) => a.name.localeCompare(b.name, "nl");
  // budgetteerbare uitgave-categorieën per groep (alfabetisch)
  const expenseInGroup = (id: string) => categories.filter((c) => c.groupId === id && c.type === "uitgave").sort(byName);
  const leaves = categories.filter((c) => c.type === "uitgave");
  const totalBudget = leaves.reduce((s, c) => s + (budgets[c.id] || 0), 0) * n;
  const totalSpent = leaves.reduce((s, c) => s + (spend[c.id] || 0), 0);
  const toAllocate = income - totalBudget;

  function GroupHeader({ g, members }: { g: CategoryGroupRow; members: Category[] }) {
    const b = members.reduce((s, k) => s + (budgets[k.id] || 0), 0) * n;
    const sp = members.reduce((s, k) => s + (spend[k.id] || 0), 0);
    const r = b ? sp / b : 0;
    return (
      <div className="bud-grid" style={{ display: "grid", gridTemplateColumns: "180px 1fr 170px", alignItems: "center", gap: 22, padding: "16px 0 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 14.5 }}>{g.name}</div>
        </div>
        <div className="bar" style={{ height: 7 }}><span style={{ width: Math.min(100, r * 100) + "%", background: budgetColor(r) }}></span></div>
        <div className="tnum" style={{ textAlign: "right", fontSize: 13, color: "var(--muted)" }}><b style={{ color: "var(--ink)" }}>{eur(sp)}</b> / {eur(b)}</div>
      </div>
    );
  }

  return (
    <div className="content-inner fade-in">
      <div className="grid grid-3" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 18 }}>
        <div className="card card-pad">
          <div className="k-lbl" style={{ marginBottom: 8 }}>{periodMode === "month" ? "Maandinkomen" : "Inkomen"}</div>
          <div className="k-val tnum">{eur(income)}</div>
          <div className="k-foot"><span className="delta-note">{periodLabel}</span></div>
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
        <div className="card-h" style={{ marginBottom: 6 }}>
          <h3>Budget per categorie</h3>
        </div>
        <p style={{ color: "var(--muted)", margin: "0 0 12px", fontSize: 13.5 }}>
          Vul je maandbudget in · {periodLabel}{periodMode === "year" ? ` · uitgaven vs. budget × ${n} maanden` : ""}
        </p>
        <div style={{ display: "flex", gap: 16, marginBottom: 6, flexWrap: "wrap" }}>
          {([["#2E7D4F", "tot 70%"], ["#D9772E", "70–85%"], ["#B23B2E", "85% of meer"]] as const).map(([c, l]) => (
            <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
              <span style={{ width: 14, height: 6, borderRadius: 99, background: c }}></span>{l}
            </span>
          ))}
        </div>
        <div>
          {categoryGroups.map((g) => {
            const members = expenseInGroup(g.id);
            if (members.length === 0) return null;
            return (
              <div key={g.id}>
                <GroupHeader g={g} members={members} />
                {members.map((k) => <BudgetLeafRow key={k.id} c={k} spent={spend[k.id] || 0} budget={budgets[k.id] || 0} count={n} reference={referenceFor(k.id)} indent />)}
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

/* Eén budget-categorie met een invoerveld naast de balk. Top-level component
 * (stabiele identiteit) zodat de lokale waarde niet reset bij elke parent-render:
 * tijdens het typen volgt de balk live, en pas bij blur/Enter schrijven we naar de DB. */
function BudgetLeafRow({ c, spent, budget, count = 1, reference, indent }: { c: Category; spent: number; budget: number; count?: number; reference?: number | null; indent?: boolean }) {
  const [val, setVal] = useState(budget);
  const editing = useRef(false);
  useEffect(() => { if (!editing.current) setVal(budget); }, [budget]);

  // Het invoerveld bewerkt het maandbudget (val); de balk/percentage vergelijken met budget × periode-maanden.
  const eff = val * count;
  const r = eff ? spent / eff : 0;
  const over = eff > 0 && spent > eff;
  const commit = (v: number) => { editing.current = false; setRecurringBudget(c.id, v); };

  return (
    <div className="bud-grid" style={{ display: "grid", gridTemplateColumns: "180px 1fr 170px", alignItems: "center", gap: 22, padding: "14px 0", paddingLeft: indent ? 18 : 0, borderBottom: "1px solid var(--line-soft)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, flex: "none" }}></span>
        <div>
          <div style={{ fontWeight: 400, color: "var(--ink)", fontSize: 14 }}>{c.name}</div>
          <div style={{ fontSize: 12, color: over ? "var(--over)" : "var(--muted)", fontWeight: 400 }}>
            {eff === 0 ? "geen budget" : over ? `${eur(spent - eff)} over` : `${eur(eff - spent)} resterend`}
          </div>
        </div>
      </div>
      <div>
        <div className="bar" style={{ height: 9 }}><span style={{ width: Math.min(100, r * 100) + "%", background: budgetColor(r) }}></span></div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 12.5 }}>
          <span className="tnum" style={{ color: "var(--muted)" }}><b style={{ color: "var(--ink)", fontWeight: 400 }}>{eur(spent)}</b> uitgegeven</span>
          <span className="tnum" style={{ color: over ? "var(--over)" : "var(--muted)", fontWeight: 400 }}>{eff ? Math.round(r * 100) + "%" : "—"}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, color: "var(--muted)" }}>Budget</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, border: "1px solid var(--line)", borderRadius: 9, padding: "5px 10px", background: "var(--surface)" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>€</span>
            <input type="number" min={0} step={10} value={val} aria-label={`Budget voor ${c.name}`}
              className="tnum"
              onFocus={() => { editing.current = true; }}
              onChange={(e) => setVal(Number(e.target.value) || 0)}
              onBlur={(e) => commit(Number(e.currentTarget.value) || 0)}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              style={{ width: 64, border: 0, outline: "none", background: "transparent", textAlign: "right", fontSize: 17, fontWeight: 700, color: "var(--ink)" }} />
          </span>
        </div>
        {reference != null && (
          <span className="tnum" style={{ fontSize: 12, color: "var(--muted)" }}>Nibud: {eur(reference * count)}</span>
        )}
      </div>
    </div>
  );
}
