import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../state/AppContext";
import { eur, MONTHS_NL, MONTHS_SH } from "../lib/format";
import {
  addPotCategory, removePotCategory, setPotMonthly, setPotOpening, setPotInverted,
  addGoalToCategory, updateGoal, moveGoalPriority, deleteGoal,
} from "../db/repo";
import { ProgressRing } from "../charts/ProgressRing";
import { TrendChart, type TrendSeries } from "../charts/TrendChart";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Ic } from "../components/Ic";
import type { SavingsGroup, SavingsRow } from "../goals/savings";

function endLabel(monthsNeeded: number): string {
  if (!isFinite(monthsNeeded)) return "—";
  const d = new Date();
  let m = d.getMonth() + monthsNeeded;
  let y = d.getFullYear();
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  return `${MONTHS_NL[m]} ${y}`;
}

function CatIcon({ group, size = 30 }: { group: { tint: string; color: string; initial: string }; size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 9, background: group.tint, color: group.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: size * 0.46, flex: "none" }}>
      {group.initial}
    </span>
  );
}

/* één doel in de prioriteitenlijst */
function GoalRow({ group, row, idx, count }: { group: SavingsGroup; row: SavingsRow; idx: number; count: number }) {
  const isActive = !row.done && idx === group.activeIdx;
  const st = row.done
    ? { label: "Voltooid", color: "var(--pos)", bg: "var(--pos-soft)" }
    : isActive
      ? { label: "Actief", color: "var(--blue)", bg: "var(--blue-soft)" }
      : { label: "In wachtrij", color: "var(--muted)", bg: "var(--subtle)" };
  const c = group.color;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "34px 1fr auto", gap: 14, alignItems: "center",
      padding: "14px 14px", borderRadius: 12, marginBottom: 8,
      background: isActive ? "var(--subtle)" : "var(--surface)",
      border: "1px solid " + (isActive ? "var(--line)" : "var(--line-soft)"),
    }}>
      <div className="tnum" style={{
        width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontSize: 15, color: row.done ? "var(--pos)" : isActive ? "#fff" : "var(--muted)",
        background: row.done ? "var(--pos-soft)" : isActive ? c : "var(--subtle)",
      }}>
        {row.done ? <Ic name="check" size={18} /> : idx + 1}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
          <input value={row.goal.name} onChange={(e) => updateGoal(row.goal.id, { name: e.target.value })}
            placeholder="Naam je doel"
            style={{ border: "1px solid transparent", borderRadius: 7, padding: "3px 6px", margin: "-3px -6px", fontSize: 14.5, fontWeight: 700, color: "var(--ink)", background: "transparent", width: "100%", maxWidth: 280, outline: "none" }}
            onFocus={(e) => (e.target.style.background = "var(--bg)")} onBlur={(e) => (e.target.style.background = "transparent")} />
          <span className="tag" style={{ background: st.bg, color: st.color, flex: "none" }}>
            <span className="dot" style={{ background: st.color }}></span>{st.label}
          </span>
        </div>
        <div className="bar" style={{ height: 7 }}>
          <span style={{ width: Math.min(100, row.pct * 100) + "%", background: row.done ? "var(--pos)" : c }}></span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12.5 }}>
          <span className="tnum" style={{ color: "var(--muted)" }}><b style={{ color: "var(--ink)" }}>{eur(row.filled)}</b> van {eur(row.goal.target)}</span>
          <span className="tnum" style={{ color: "var(--muted)", fontWeight: 700 }}>{Math.round(row.pct * 100)}%</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>doel €</span>
          <input type="number" value={row.goal.target} step={500} min={0}
            onChange={(e) => updateGoal(row.goal.id, { target: Number(e.target.value) || 0 })}
            className="tnum" style={{ width: 84, border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px", fontSize: 13.5, fontWeight: 700, color: "var(--ink)", outline: "none", textAlign: "right", background: "var(--surface)" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="reorder" data-disabled={idx === 0} title="Hogere prioriteit"
            onClick={() => { if (idx > 0) moveGoalPriority(row.goal.id, "up"); }}><Ic name="chevronUp" size={16} /></span>
          <span className="reorder" data-disabled={idx === count - 1} title="Lagere prioriteit"
            onClick={() => { if (idx < count - 1) moveGoalPriority(row.goal.id, "down"); }}><Ic name="chevronDown" size={16} /></span>
        </div>
        <span className="reorder" title="Verwijderen" onClick={() => deleteGoal(row.goal.id)}><Ic name="x" size={15} /></span>
      </div>
    </div>
  );
}

export function Savings() {
  const { savingsGroups, savingsLibrary } = useApp();
  const [selId, setSelId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<SavingsGroup | null>(null);
  const addRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) { if (addRef.current && !addRef.current.contains(e.target as Node)) setAddOpen(false); }
    if (addOpen) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [addOpen]);

  useEffect(() => {
    if (savingsGroups.length && (!selId || !savingsGroups.some((g) => g.categoryId === selId))) {
      setSelId(savingsGroups[0].categoryId);
    }
  }, [savingsGroups, selId]);

  const group = savingsGroups.find((g) => g.categoryId === selId) ?? savingsGroups[0] ?? null;
  const active = group ? group.rows[group.activeIdx] : undefined;

  const monthsActive = group && active && group.monthly > 0 ? Math.ceil(Math.max(0, active.goal.target - active.filled) / group.monthly) : Infinity;
  const monthsAll = group && group.monthly > 0 ? Math.ceil(Math.max(0, group.totalTarget - group.balance) / group.monthly) : Infinity;

  const proj = useMemo(() => {
    const labels: string[] = [], data: number[] = [], target: number[] = [];
    if (!group || !active) return { labels, data, target };
    let bal = active.filled;
    const cap = Math.min(30, isFinite(monthsActive) ? monthsActive + 2 : 18);
    const now = new Date();
    for (let i = 0; i <= cap; i++) {
      let m = now.getMonth() + i; let y = now.getFullYear(); y += Math.floor(m / 12); m = m % 12;
      labels.push(i % 3 === 0 ? `${MONTHS_SH[m]} '${String(y).slice(2)}` : "");
      data.push(Math.min(bal, active.goal.target * 1.02));
      target.push(active.goal.target);
      bal += group.monthly;
    }
    return { labels, data, target };
  }, [group?.categoryId, active?.goal.id, active?.filled, active?.goal.target, group?.monthly, monthsActive]);

  const projSeries: TrendSeries[] = group ? [
    { key: "doel", name: "Doel", color: "var(--orange)", data: proj.target, noArea: true, dashed: true },
    { key: "groei", name: "Groei", color: group.color, data: proj.data },
  ] : [];

  return (
    <div className="content-inner fade-in">
      {/* ── categorie-ribbon ── */}
      <div className="card" style={{ padding: 10, marginBottom: 18 }}>
        <div className="scroll" style={{ display: "flex", gap: 8, alignItems: "stretch", overflowX: "auto" }}>
          {savingsGroups.map((g) => {
            const pct = g.totalTarget ? Math.min(100, Math.round((g.balance / g.totalTarget) * 100)) : 0;
            const doneCount = g.rows.filter((r) => r.done).length;
            const on = g.categoryId === selId;
            return (
              <button key={g.categoryId} onClick={() => setSelId(g.categoryId)}
                style={{ flex: "1 1 0", minWidth: 160, textAlign: "left", cursor: "pointer", border: "1px solid " + (on ? g.color : "var(--line)"), background: on ? g.tint : "var(--surface)", borderRadius: 12, padding: "12px 14px", boxShadow: on ? "inset 0 0 0 1px " + g.color : "none", transition: "all .15s var(--ease)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
                  <CatIcon group={g} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 14, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>{doneCount}/{g.rows.length} doelen · {pct}%</div>
                  </div>
                </div>
                <div className="bar" style={{ height: 6 }}><span style={{ width: pct + "%", background: g.color }}></span></div>
              </button>
            );
          })}

          <div ref={addRef} style={{ position: "relative", flex: "0 0 auto" }}>
            <button onClick={() => setAddOpen((o) => !o)} disabled={savingsLibrary.length === 0}
              style={{ height: "100%", width: "100%", minWidth: 150, border: "1.5px dashed var(--line)", background: "var(--bg)", borderRadius: 12, padding: "12px 16px", color: savingsLibrary.length ? "var(--blue)" : "var(--faint)", fontWeight: 700, fontSize: 13.5, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: savingsLibrary.length ? "pointer" : "default" }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--blue-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic name="plus" size={18} /></span>
              Categorie toevoegen
            </button>
            {addOpen && savingsLibrary.length > 0 && (
              <div className="cat-menu scroll" style={{ left: "auto", right: 0, minWidth: 210 }}>
                <div className="cat-group">Kies een categorie</div>
                {savingsLibrary.map((c) => (
                  <button key={c.id} className="cat-opt" onClick={() => { addPotCategory(c.id); setSelId(c.id); setAddOpen(false); }}>
                    <span className="dot" style={{ background: c.color }}></span>{c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {!group ? (
        <div className="card card-pad"><div className="empty">Nog geen spaarcategorieën. Voeg er één toe om te beginnen.</div></div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "0.95fr 1.35fr", alignItems: "start" }}>
          {/* links — actief doel */}
          <div className="card card-pad" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ alignSelf: "stretch", display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <CatIcon group={group} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>{group.name}</h3>
              <button className="btn btn-ghost" style={{ marginLeft: "auto", padding: 5 }} title="Categorie verwijderen" onClick={() => setConfirmRemove(group)}><Ic name="x" size={16} /></button>
            </div>

            {group.allDone ? (
              <div style={{ padding: "26px 0 18px" }}>
                <span style={{ width: 84, height: 84, borderRadius: "50%", background: "var(--pos-soft)", color: "var(--pos)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><Ic name="check" size={40} /></span>
                <div style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>Alle doelen gehaald!</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Voeg een nieuw doel toe om door te sparen.</div>
              </div>
            ) : active ? (
              <>
                <div className="ring-wrap" style={{ margin: "16px 0 8px" }}>
                  <ProgressRing value={active.filled} max={active.goal.target} size={206} thickness={18} color={group.color} />
                  <div className="ring-center">
                    <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>actief doel · {Math.round(active.pct * 100)}%</div>
                    <div className="tnum" style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)", lineHeight: 1.1 }}>{eur(active.filled)}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>van {eur(active.goal.target)}</div>
                  </div>
                </div>
                <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 16 }}>{active.goal.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                  Nog {eur(Math.max(0, active.goal.target - active.filled))} · klaar rond <b style={{ color: group.color }}>{endLabel(monthsActive)}</b>
                </div>
              </>
            ) : (
              <div style={{ padding: "30px 0" }}><div className="empty">Nog geen doel in deze categorie. Voeg er één toe.</div></div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%", marginTop: 18 }}>
              <div style={{ background: "var(--subtle)", borderRadius: 12, padding: "12px 14px", textAlign: "left" }}>
                <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>Totaal gespaard</div>
                <div className="tnum" style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>{eur(group.balance)}</div>
                <div style={{ fontSize: 11.5, color: "var(--faint)", fontWeight: 600 }}>van {eur(group.totalTarget)}</div>
              </div>
              <div style={{ background: group.tint, borderRadius: 12, padding: "12px 14px", textAlign: "left" }}>
                <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>Alles klaar rond</div>
                <div className="tnum" style={{ fontSize: 18, fontWeight: 800, color: group.color }}>{endLabel(monthsAll)}</div>
                <div style={{ fontSize: 11.5, color: "var(--faint)", fontWeight: 600 }}>bij {eur(group.monthly)}/mnd</div>
              </div>
            </div>

            <div style={{ width: "100%", marginTop: 16, textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "baseline", marginBottom: 8 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>Maandelijkse inleg</label>
                <span className="tnum" style={{ marginLeft: "auto", fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{eur(group.monthly)}</span>
              </div>
              <input type="range" className="rng" min={0} max={1500} step={10} value={Math.min(1500, group.monthly)}
                onChange={(e) => setPotMonthly(group.categoryId, Number(e.target.value))} />
            </div>

            <div style={{ width: "100%", marginTop: 16, display: "grid", gridTemplateColumns: "1fr", gap: 10, textAlign: "left" }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>Startsaldo (nul lijn)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>€</span>
                  <input type="number" value={group.opening} step={50} min={0}
                    onChange={(e) => setPotOpening(group.categoryId, Number(e.target.value) || 0)}
                    className="tnum" style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 8, padding: "7px 10px", fontSize: 14, fontWeight: 700, color: "var(--ink)", outline: "none", background: "var(--surface)" }} />
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--body)", cursor: "pointer" }}>
                <input type="checkbox" checked={group.inverted} onChange={(e) => setPotInverted(group.categoryId, e.target.checked)} style={{ accentColor: "var(--blue)", width: 15, height: 15 }} />
                Inleg staat als afschrijving (−)
              </label>
            </div>
          </div>

          {/* rechts — prioriteitenlijst + projectie */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="card card-pad">
              <div className="card-h" style={{ marginBottom: 12 }}>
                <h3>Doelen op prioriteit</h3>
                <span className="hint">Je inleg vult de doelen van boven naar beneden</span>
              </div>
              <div>
                {group.rows.map((row, i) => (
                  <GoalRow key={row.goal.id} group={group} row={row} idx={i} count={group.rows.length} />
                ))}
              </div>
              <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 6, borderStyle: "dashed", color: "var(--blue)" }}
                onClick={() => addGoalToCategory(group.categoryId)}>
                <Ic name="plus" size={16} /> Doel toevoegen aan {group.name}
              </button>
            </div>

            {!group.allDone && active && (
              <div className="card card-pad">
                <div className="card-h" style={{ marginBottom: 6 }}>
                  <h3>Verwachte groei — {active.goal.name}</h3>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 16 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: group.color }}></span>Groei</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600 }}><span style={{ width: 14, height: 3, borderRadius: 3, background: "var(--orange)" }}></span>Doel</span>
                  </div>
                </div>
                <TrendChart series={projSeries} labels={proj.labels} height={208} />
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmRemove}
        title={`Categorie "${confirmRemove?.name}" verwijderen?`}
        message="Hiermee verwijder je deze spaarcategorie inclusief alle doelen erin. Het startsaldo en de inleg-instelling gaan verloren. Je transacties blijven ongewijzigd."
        confirmLabel="Verwijder categorie"
        onCancel={() => setConfirmRemove(null)}
        onConfirm={async () => { if (confirmRemove) await removePotCategory(confirmRemove.categoryId); setConfirmRemove(null); }}
      />
    </div>
  );
}
