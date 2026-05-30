import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext";
import { eur } from "../lib/format";
import { calcGoal } from "../goals/goalCalc";
import { upsertGoal, deleteGoal } from "../db/repo";
import { ProgressRing } from "../charts/ProgressRing";
import { TrendChart, type TrendSeries } from "../charts/TrendChart";
import { Ic } from "../components/Ic";
import type { Goal } from "../db/types";
import focusTarget from "../assets/focus-target.svg";

const GOAL_COLORS = ["var(--blue)", "var(--orange)", "var(--pos)", "var(--cat-4)", "var(--cat-6)"];

export function Savings() {
  const { goals } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (goals.length && (!selectedId || !goals.some((g) => g.id === selectedId))) {
      setSelectedId(goals[0].id);
    }
  }, [goals, selectedId]);

  const goal = goals.find((g) => g.id === selectedId) ?? goals[0] ?? null;

  async function addGoal() {
    const priority = (goals.at(-1)?.priority ?? 0) + 1;
    const color = GOAL_COLORS[goals.length % GOAL_COLORS.length];
    const today = new Date();
    const target = new Date(today.getFullYear() + 2, today.getMonth(), 1);
    await upsertGoal({
      name: "Nieuw doel", target: 5000, current: 0, monthly: 200,
      startDate: today.toISOString().slice(0, 10),
      targetDate: target.toISOString().slice(0, 10),
      priority, color,
    });
  }

  async function save(g: Goal, patch: Partial<Goal>) {
    await upsertGoal({ ...g, ...patch });
  }

  return (
    <div className="content-inner fade-in">
      {/* doelenlijst */}
      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="card-h" style={{ marginBottom: 14 }}>
          <h3>Je spaardoelen</h3>
          <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={addGoal}><Ic name="plus" size={16} /> Nieuw doel</button>
        </div>
        {goals.length === 0 ? (
          <div className="empty">Nog geen spaardoelen. Maak er een aan om je voortgang te volgen.</div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {goals.map((g) => {
              const c = calcGoal(g);
              const active = g.id === goal?.id;
              return (
                <button key={g.id} onClick={() => setSelectedId(g.id)}
                  style={{ textAlign: "left", border: active ? `1px solid ${g.color}` : "1px solid var(--line)", background: active ? "var(--subtle)" : "#fff", borderRadius: 12, padding: "14px 16px", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: g.color }}></span>
                    <span style={{ fontWeight: 800, color: "var(--ink)", fontSize: 14 }}>{g.name}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>#{g.priority}</span>
                  </div>
                  <div className="bar" style={{ height: 8 }}><span style={{ width: c.pct + "%", background: g.color }}></span></div>
                  <div className="tnum" style={{ marginTop: 8, fontSize: 12.5, color: "var(--muted)" }}>
                    <b style={{ color: "var(--ink)" }}>{eur(g.current)}</b> / {eur(g.target)} · {c.pct}%
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {goal && <GoalDetail key={goal.id} goal={goal} canDelete={goals.length > 1} onSave={save} onDelete={() => deleteGoal(goal.id)} />}
    </div>
  );
}

function GoalDetail({ goal, canDelete, onSave, onDelete }: {
  goal: Goal; canDelete: boolean;
  onSave: (g: Goal, patch: Partial<Goal>) => void; onDelete: () => void;
}) {
  const c = calcGoal(goal);
  const projSeries: TrendSeries[] = [
    { key: "doel", name: "Doel", color: "var(--orange)", data: c.projection.target, noArea: true, dashed: true },
    { key: "groei", name: "Verwachte groei", color: "var(--blue)", data: c.projection.growth },
  ];

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 1.5fr", alignItems: "start" }}>
      <div className="card card-pad" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ alignSelf: "stretch", display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <img src={focusTarget} alt="" style={{ width: 26, height: 26 }} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>Dit doel</h3>
          {canDelete && (
            <button className="btn btn-ghost" style={{ marginLeft: "auto", padding: "5px 9px" }} title="Doel verwijderen" onClick={onDelete}>
              <Ic name="trash" size={16} />
            </button>
          )}
        </div>
        <div className="ring-wrap" style={{ margin: "14px 0 8px" }}>
          <ProgressRing value={goal.current} max={goal.target} size={208} thickness={18} color={goal.color} />
          <div className="ring-center">
            <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 700 }}>{c.pct}% gehaald</div>
            <div className="tnum" style={{ fontSize: 30, fontWeight: 800, color: "var(--ink)", lineHeight: 1.1 }}>{eur(goal.current)}</div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>van {eur(goal.target)}</div>
          </div>
        </div>
        <input value={goal.name} onChange={(e) => onSave(goal, { name: e.target.value })}
          style={{ textAlign: "center", border: "1px solid transparent", borderRadius: 8, padding: "6px 10px", fontSize: 17, fontWeight: 800, color: "var(--ink)", width: "100%", background: "transparent" }}
          onFocus={(e) => (e.target.style.background = "var(--subtle)")} onBlur={(e) => (e.target.style.background = "transparent")} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%", marginTop: 14 }}>
          <div style={{ background: "var(--subtle)", borderRadius: 12, padding: "12px 14px", textAlign: "left" }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>Nog te gaan</div>
            <div className="tnum" style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>{eur(c.remaining)}</div>
          </div>
          <div style={{ background: "var(--blue-tint)", borderRadius: 12, padding: "12px 14px", textAlign: "left" }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>Klaar rond</div>
            <div className="tnum" style={{ fontSize: 18, fontWeight: 800, color: "var(--blue)" }}>{c.endLabel}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="card card-pad">
          <div className="card-h" style={{ marginBottom: 16 }}><h3>Doel afstemmen</h3></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
            <Field label="Doelbedrag" value={goal.target} step={500} min={0} max={40000} sliderMin={2000}
              onChange={(v) => onSave(goal, { target: v })} />
            <Field label="Maandelijkse inleg" value={goal.monthly} step={10} min={0} max={1500} sliderMin={0}
              onChange={(v) => onSave(goal, { monthly: v })} />
          </div>
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
            <Field label="Al gespaard" value={goal.current} step={50} min={0} max={Math.max(40000, goal.target)} sliderMin={0}
              onChange={(v) => onSave(goal, { current: v })} />
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>Prioriteit</label>
              <input type="number" value={goal.priority} min={1} step={1} onChange={(e) => onSave(goal, { priority: Number(e.target.value) || 1 })}
                className="tnum" style={{ display: "block", width: "100%", marginTop: 8, border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", fontSize: 17, fontWeight: 800, color: "var(--ink)", outline: "none" }} />
            </div>
          </div>
          <div className="notice" style={{ marginTop: 18 }}>
            <span className="ni"><Ic name="info" size={20} /></span>
            <div className="nt">
              Met <b>{eur(goal.monthly)}</b> per maand bereik je <b>{eur(goal.target)}</b> in ongeveer <b>{isFinite(c.monthsNeeded) ? c.monthsNeeded + " maanden" : "—"}</b>, rond <b>{c.endLabel}</b>.
            </div>
          </div>
        </div>

        <div className="card card-pad">
          <div className="card-h" style={{ marginBottom: 6 }}>
            <h3>Verwachte groei</h3>
            <div style={{ marginLeft: "auto", display: "flex", gap: 16 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: "var(--blue)" }}></span>Groei</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600 }}><span style={{ width: 14, height: 3, borderRadius: 3, background: "var(--orange)" }}></span>Doel</span>
            </div>
          </div>
          <TrendChart series={projSeries} labels={c.projection.labels} height={232} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, step, min, max, sliderMin, onChange }: {
  label: string; value: number; step: number; min: number; max: number; sliderMin: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>€</span>
        <input type="number" value={value} step={step} min={min} onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="tnum" style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", fontSize: 17, fontWeight: 800, color: "var(--ink)", outline: "none" }} />
      </div>
      <input type="range" className="rng" min={sliderMin} max={max} step={step} value={Math.min(max, value)} onChange={(e) => onChange(Number(e.target.value))} style={{ marginTop: 14 }} />
    </div>
  );
}
