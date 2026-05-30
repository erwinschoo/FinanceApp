/* FinanceApp — Spaardoel: categorieën met geprioriteerde doelen */

function statusOf(rows, i) {
  if (rows[i].done) return { label: "Voltooid", color: "var(--pos)", bg: "var(--pos-soft)" };
  const firstOpen = rows.findIndex(r => !r.done);
  if (i === firstOpen) return { label: "Actief", color: "var(--blue)", bg: "var(--blue-soft)" };
  return { label: "In wachtrij", color: "var(--muted)", bg: "var(--subtle)" };
}

function endLabelFrom(months) {
  const D = window.FA_DATA;
  if (!isFinite(months)) return "—";
  let m = D.NOW.m + months, y = D.NOW.y; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  return `${D.MONTHS_NL[m]} ${y}`;
}

/* ── one goal in the priority list ── */
function GoalRow({ group, row, idx, count, alloc, actions }) {
  const st = statusOf(alloc.rows, idx);
  const c = group.color;
  const isActive = st.label === "Actief";
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "34px 1fr auto", gap: 14, alignItems: "center",
      padding: "14px 14px", borderRadius: 12, marginBottom: 8,
      background: isActive ? "var(--subtle)" : "#fff",
      border: "1px solid " + (isActive ? "var(--line)" : "var(--line-soft)"),
    }}>
      {/* priority badge */}
      <div style={{
        width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontSize: 15, color: row.done ? "var(--pos)" : isActive ? "#fff" : "var(--muted)",
        background: row.done ? "var(--pos-soft)" : isActive ? c : "var(--subtle)",
      }} className="tnum">
        {row.done ? <Ic name="check" size={18} /> : idx + 1}
      </div>

      {/* name + progress */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
          <input value={row.name} onChange={e => actions.updateGoal(group.id, row.id, { name: e.target.value })}
            style={{ border: "1px solid transparent", borderRadius: 7, padding: "3px 6px", margin: "-3px -6px",
              fontSize: 14.5, fontWeight: 700, color: "var(--ink)", background: "transparent", width: "100%", maxWidth: 280, outline: "none" }}
            onFocus={e => e.target.style.background = "#fff"} onBlur={e => e.target.style.background = "transparent"} />
          <span className="tag" style={{ background: st.bg, color: st.color, flex: "none" }}>
            <span className="dot" style={{ background: st.color }}></span>{st.label}
          </span>
        </div>
        <div className="bar" style={{ height: 7 }}>
          <span style={{ width: Math.min(100, row.pct * 100) + "%", background: row.done ? "var(--pos)" : c }}></span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12.5 }}>
          <span className="tnum" style={{ color: "var(--muted)" }}><b style={{ color: "var(--ink)" }}>{eur(row.filled)}</b> van {eur(row.target)}</span>
          <span className="tnum" style={{ color: "var(--muted)", fontWeight: 700 }}>{Math.round(row.pct * 100)}%</span>
        </div>
      </div>

      {/* controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>doel €</span>
          <input type="number" value={row.target} step="500" min="0"
            onChange={e => actions.updateGoal(group.id, row.id, { target: Number(e.target.value) || 0 })}
            className="tnum" style={{ width: 84, border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px",
              fontSize: 13.5, fontWeight: 700, color: "var(--ink)", outline: "none", textAlign: "right" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <button className="btn-ghost" style={{ padding: 2, borderRadius: 6, border: 0, background: "transparent", color: idx === 0 ? "var(--faint)" : "var(--muted)", cursor: idx === 0 ? "default" : "pointer" }}
            disabled={idx === 0} onClick={() => actions.move(group.id, row.id, -1)} title="Hogere prioriteit"><Ic name="chevronUp" size={16} /></button>
          <button className="btn-ghost" style={{ padding: 2, borderRadius: 6, border: 0, background: "transparent", color: idx === count - 1 ? "var(--faint)" : "var(--muted)", cursor: idx === count - 1 ? "default" : "pointer" }}
            disabled={idx === count - 1} onClick={() => actions.move(group.id, row.id, 1)} title="Lagere prioriteit"><Ic name="chevronDown" size={16} /></button>
        </div>
        <button className="btn-ghost" style={{ padding: 5, borderRadius: 7, border: 0, background: "transparent", color: "var(--faint)" }}
          onClick={() => actions.removeGoal(group.id, row.id)} title="Verwijderen"><Ic name="x" size={15} /></button>
      </div>
    </div>
  );
}

function SavingsView() {
  const ctx = React.useContext(FAContext);
  const { savingsGroups, sgActions } = ctx;
  const D = window.FA_DATA;
  const [selId, setSelId] = React.useState(savingsGroups[0] ? savingsGroups[0].id : null);
  const [addOpen, setAddOpen] = React.useState(false);
  const addRef = React.useRef(null);

  React.useEffect(() => {
    function h(e) { if (addRef.current && !addRef.current.contains(e.target)) setAddOpen(false); }
    if (addOpen) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [addOpen]);

  // keep selection valid
  React.useEffect(() => {
    if (!savingsGroups.some(g => g.id === selId) && savingsGroups[0]) setSelId(savingsGroups[0].id);
  }, [savingsGroups, selId]);

  const group = savingsGroups.find(g => g.id === selId) || savingsGroups[0];
  const available = D.SAVINGS_LIBRARY.filter(l => !savingsGroups.some(g => g.id === l.id));

  if (!group) {
    return <div className="content-inner fade-in"><div className="card card-pad"><div className="empty">Nog geen spaarcategorieën. Voeg er één toe om te beginnen.</div></div></div>;
  }

  const alloc = allocateGoals(group);
  const active = alloc.rows[alloc.activeIdx];
  const totalTarget = group.goals.reduce((s, g) => s + g.target, 0);
  const activeRemaining = active ? Math.max(0, active.target - active.filled) : 0;
  const monthsActive = group.monthly > 0 ? Math.ceil(activeRemaining / group.monthly) : Infinity;
  const monthsAll = group.monthly > 0 ? Math.ceil(Math.max(0, totalTarget - group.balance) / group.monthly) : Infinity;

  // projection for the ACTIVE goal
  const proj = React.useMemo(() => {
    if (!active) return { labels: [], data: [], target: [] };
    const labels = [], data = [], target = [];
    let bal = active.filled;
    const cap = Math.min(30, isFinite(monthsActive) ? monthsActive + 2 : 18);
    for (let i = 0; i <= cap; i++) {
      let m = D.NOW.m + i, y = D.NOW.y; y += Math.floor(m / 12); m = m % 12;
      labels.push(i % 3 === 0 ? `${D.MONTHS_SH[m]} '${String(y).slice(2)}` : "");
      data.push(Math.min(bal, active.target * 1.02));
      target.push(active.target);
      bal += group.monthly;
    }
    return { labels, data, target };
  }, [active && active.id, active && active.filled, active && active.target, group.monthly, monthsActive]);

  const projSeries = [
    { key: "doel", name: "Doel", color: "var(--orange)", data: proj.target, noArea: true, dashed: true },
    { key: "groei", name: "Groei", color: group.color, data: proj.data },
  ];

  return (
    <div className="content-inner fade-in">
      {/* ── category ribbon ── */}
      <div className="card" style={{ padding: 10, marginBottom: 18 }}>
        <div className="scroll" style={{ display: "flex", gap: 8, alignItems: "stretch", overflowX: "auto" }}>
          {savingsGroups.map(g => {
            const a = allocateGoals(g);
            const tot = g.goals.reduce((s, x) => s + x.target, 0);
            const pct = tot ? Math.min(100, Math.round((g.balance / tot) * 100)) : 0;
            const doneCount = a.rows.filter(r => r.done).length;
            const on = g.id === selId;
            return (
              <button key={g.id} onClick={() => setSelId(g.id)}
                style={{
                  flex: "1 1 0", minWidth: 160, textAlign: "left", cursor: "pointer",
                  border: "1px solid " + (on ? g.color : "var(--line)"),
                  background: on ? g.tint : "#fff", borderRadius: 12, padding: "12px 14px",
                  boxShadow: on ? "inset 0 0 0 1px " + g.color : "none", transition: "all .15s var(--ease)",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, background: g.tint, color: g.color, display: "flex", alignItems: "center", justifyContent: "center", border: on ? "1px solid " + g.color : "none" }}>
                    <Ic name={g.icon} size={17} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 14, lineHeight: 1.1 }}>{g.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>{doneCount}/{g.goals.length} doelen · {pct}%</div>
                  </div>
                </div>
                <div className="bar" style={{ height: 6 }}><span style={{ width: pct + "%", background: g.color }}></span></div>
              </button>
            );
          })}

          {/* add category */}
          <div ref={addRef} style={{ position: "relative", flex: "0 0 auto" }}>
            <button onClick={() => setAddOpen(o => !o)} disabled={available.length === 0}
              style={{
                height: "100%", width: "100%", minWidth: 150, border: "1.5px dashed var(--line)", background: "var(--bg)", borderRadius: 12,
                padding: "12px 16px", color: available.length ? "var(--blue)" : "var(--faint)", fontWeight: 700, fontSize: 13.5,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
                cursor: available.length ? "pointer" : "default",
              }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--blue-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic name="plus" size={18} /></span>
              Categorie toevoegen
            </button>
            {addOpen && available.length > 0 && (
              <div className="cat-menu scroll" style={{ left: "auto", right: 0, minWidth: 210 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--faint)", padding: "4px 10px 6px" }}>Kies een categorie</div>
                {available.map(l => (
                  <button key={l.id} className="cat-opt" onClick={() => { sgActions.addCategory(l); setSelId(l.id); setAddOpen(false); }}>
                    <span style={{ width: 26, height: 26, borderRadius: 8, background: l.tint, color: l.color, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Ic name={l.icon} size={15} /></span>
                    {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── selected category ── */}
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,0.95fr) minmax(0,1.35fr)", alignItems: "start" }}>
        {/* left — active goal hero */}
        <div className="card card-pad" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div style={{ alignSelf: "stretch", display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: group.tint, color: group.color, display: "flex", alignItems: "center", justifyContent: "center" }}><Ic name={group.icon} size={17} /></span>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>{group.name}</h3>
            {savingsGroups.length > 1 && (
              <button className="btn-ghost" style={{ marginLeft: "auto", padding: 5, border: 0, background: "transparent", color: "var(--faint)" }}
                onClick={() => sgActions.removeCategory(group.id)} title="Categorie verwijderen"><Ic name="x" size={16} /></button>
            )}
          </div>

          {alloc.allDone ? (
            <div style={{ padding: "26px 0 18px" }}>
              <span style={{ width: 84, height: 84, borderRadius: "50%", background: "var(--pos-soft)", color: "var(--pos)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><Ic name="trophy" size={40} /></span>
              <div style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>Alle doelen gehaald!</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Voeg een nieuw doel toe om door te sparen.</div>
            </div>
          ) : (
            <>
              <div className="ring-wrap" style={{ margin: "16px 0 8px" }}>
                <ProgressRing value={active.filled} max={active.target} size={206} thickness={18} color={group.color} />
                <div className="ring-center">
                  <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>actief doel · {Math.round(active.pct * 100)}%</div>
                  <div className="tnum" style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)", lineHeight: 1.1 }}>{eur(active.filled)}</div>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>van {eur(active.target)}</div>
                </div>
              </div>
              <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 16 }}>{active.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                Nog {eur(activeRemaining)} · klaar rond <b style={{ color: group.color }}>{endLabelFrom(monthsActive)}</b>
              </div>
            </>
          )}

          {/* category totals */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%", marginTop: 18 }}>
            <div style={{ background: "var(--subtle)", borderRadius: 12, padding: "12px 14px", textAlign: "left" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>Totaal gespaard</div>
              <div className="tnum" style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>{eur(group.balance)}</div>
              <div style={{ fontSize: 11.5, color: "var(--faint)", fontWeight: 600 }}>van {eur(totalTarget)}</div>
            </div>
            <div style={{ background: group.tint, borderRadius: 12, padding: "12px 14px", textAlign: "left" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>Alles klaar rond</div>
              <div className="tnum" style={{ fontSize: 18, fontWeight: 800, color: group.color }}>{endLabelFrom(monthsAll)}</div>
              <div style={{ fontSize: 11.5, color: "var(--faint)", fontWeight: 600 }}>bij {eur(group.monthly)}/mnd</div>
            </div>
          </div>

          {/* monthly inleg control */}
          <div style={{ width: "100%", marginTop: 16, textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "baseline", marginBottom: 8 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>Maandelijkse inleg</label>
              <span className="tnum" style={{ marginLeft: "auto", fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{eur(group.monthly)}</span>
            </div>
            <input type="range" className="rng" min="0" max="1500" step="10" value={Math.min(1500, group.monthly)}
              onChange={e => sgActions.setMonthly(group.id, Number(e.target.value))} />
          </div>
        </div>

        {/* right — priority list + projection */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card card-pad">
            <div className="card-h" style={{ marginBottom: 4 }}>
              <h3>Doelen op prioriteit</h3>
              <span className="hint">Je inleg vult de doelen van boven naar beneden</span>
            </div>
            <div className="notice" style={{ margin: "10px 0 16px" }}>
              <span className="ni"><Ic name="info" size={20} /></span>
              <div className="nt">Doel <b>1</b> wordt eerst gevuld. Zodra dat is gehaald, stroomt je maandinleg automatisch door naar doel <b>2</b>, dan <b>3</b>. Gebruik de pijltjes om de volgorde te wijzigen.</div>
            </div>
            <div>
              {alloc.rows.map((row, i) => (
                <GoalRow key={row.id} group={group} row={row} idx={i} count={alloc.rows.length} alloc={alloc} actions={sgActions} />
              ))}
            </div>
            <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 6, borderStyle: "dashed", color: "var(--blue)" }}
              onClick={() => sgActions.addGoal(group.id)}>
              <Ic name="plus" size={16} /> Doel toevoegen aan {group.name}
            </button>
          </div>

          {!alloc.allDone && (
            <div className="card card-pad">
              <div className="card-h" style={{ marginBottom: 6 }}>
                <h3>Verwachte groei — {active.name}</h3>
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
    </div>
  );
}

window.SavingsView = SavingsView;
