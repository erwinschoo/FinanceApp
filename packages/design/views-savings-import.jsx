/* FinanceApp — Spaardoel & Importeren views */

function SavingsView() {
  const ctx = React.useContext(FAContext);
  const { savings, setSavings } = ctx;
  const D = window.FA_DATA;

  const remaining = Math.max(0, savings.target - savings.current);
  const pct = Math.min(100, Math.round((savings.current / savings.target) * 100));
  const monthsNeeded = savings.monthly > 0 ? Math.ceil(remaining / savings.monthly) : Infinity;

  // projected end date from NOW (May 2026)
  const endLabel = React.useMemo(() => {
    if (!isFinite(monthsNeeded)) return "—";
    let m = D.NOW.m + monthsNeeded, y = D.NOW.y;
    y += Math.floor(m / 12); m = m % 12;
    return `${D.MONTHS_NL[m]} ${y}`;
  }, [monthsNeeded]);

  // projection chart: cumulative savings forward until target (cap 30 mo)
  const proj = React.useMemo(() => {
    const labels = [], cumdata = [], target = [];
    let bal = savings.current;
    const cap = Math.min(30, isFinite(monthsNeeded) ? monthsNeeded + 2 : 18);
    for (let i = 0; i <= cap; i++) {
      let m = D.NOW.m + i, y = D.NOW.y; y += Math.floor(m / 12); m = m % 12;
      labels.push(i % 3 === 0 ? `${D.MONTHS_SH[m]} '${String(y).slice(2)}` : "");
      cumdataPush(cumdata, bal, savings.target);
      target.push(savings.target);
      bal += savings.monthly;
    }
    return { labels, cumdata, target };
    function cumdataPush(arr, v, t) { arr.push(Math.min(v, t * 1.02)); }
  }, [savings.current, savings.monthly, savings.target, monthsNeeded]);

  const projSeries = [
    { key: "doel", name: "Doel", color: "var(--orange)", data: proj.target, noArea: true, dashed: true },
    { key: "groei", name: "Verwachte groei", color: "var(--blue)", data: proj.cumdata },
  ];

  function adj(field, val) { setSavings(s => ({ ...s, [field]: val })); }

  return (
    <div className="content-inner fade-in">
      <div className="grid" style={{ gridTemplateColumns: "1fr 1.5fr", alignItems: "start" }}>
        {/* left — goal + ring */}
        <div className="card card-pad" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div style={{ alignSelf: "stretch", display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <img src="assets/icons/focus-target.svg" alt="" style={{ width: 26, height: 26 }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>Je spaardoel</h3>
          </div>
          <div className="ring-wrap" style={{ margin: "14px 0 8px" }}>
            <ProgressRing value={savings.current} max={savings.target} size={208} thickness={18} color="var(--blue)" />
            <div className="ring-center">
              <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 700 }}>{pct}% gehaald</div>
              <div className="tnum" style={{ fontSize: 30, fontWeight: 800, color: "var(--ink)", lineHeight: 1.1 }}>{eur(savings.current)}</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>van {eur(savings.target)}</div>
            </div>
          </div>
          <input value={savings.goalName} onChange={e => adj("goalName", e.target.value)}
            style={{ textAlign: "center", border: "1px solid transparent", borderRadius: 8, padding: "6px 10px", fontSize: 17, fontWeight: 800, color: "var(--ink)", width: "100%", background: "transparent" }}
            onFocus={e => e.target.style.background = "var(--subtle)"} onBlur={e => e.target.style.background = "transparent"} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%", marginTop: 14 }}>
            <div style={{ background: "var(--subtle)", borderRadius: 12, padding: "12px 14px", textAlign: "left" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>Nog te gaan</div>
              <div className="tnum" style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>{eur(remaining)}</div>
            </div>
            <div style={{ background: "var(--blue-tint)", borderRadius: 12, padding: "12px 14px", textAlign: "left" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>Klaar rond</div>
              <div className="tnum" style={{ fontSize: 18, fontWeight: 800, color: "var(--blue)" }}>{endLabel}</div>
            </div>
          </div>
        </div>

        {/* right — controls + projection */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card card-pad">
            <div className="card-h" style={{ marginBottom: 16 }}><h3>Doel afstemmen</h3></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>Doelbedrag</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>€</span>
                  <input type="number" value={savings.target} step="500" min="0" onChange={e => adj("target", Number(e.target.value) || 0)}
                    className="tnum" style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", fontSize: 17, fontWeight: 800, color: "var(--ink)", outline: "none" }} />
                </div>
                <input type="range" className="rng" min="2000" max="40000" step="500" value={Math.min(40000, savings.target)} onChange={e => adj("target", Number(e.target.value))} style={{ marginTop: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>Maandelijkse inleg</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>€</span>
                  <input type="number" value={savings.monthly} step="10" min="0" onChange={e => adj("monthly", Number(e.target.value) || 0)}
                    className="tnum" style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", fontSize: 17, fontWeight: 800, color: "var(--ink)", outline: "none" }} />
                </div>
                <input type="range" className="rng" min="0" max="1500" step="10" value={Math.min(1500, savings.monthly)} onChange={e => adj("monthly", Number(e.target.value))} style={{ marginTop: 14 }} />
              </div>
            </div>
            <div className="notice" style={{ marginTop: 18 }}>
              <span className="ni"><Ic name="info" size={20} /></span>
              <div className="nt">
                Met <b>{eur(savings.monthly)}</b> per maand bereik je <b>{eur(savings.target)}</b> in ongeveer <b>{isFinite(monthsNeeded) ? monthsNeeded + " maanden" : "—"}</b>, rond <b>{endLabel}</b>.
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
            <TrendChart series={projSeries} labels={proj.labels} height={232} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Importeren ── */
const IMPORT_SAMPLE = [
  { date: "22 mei", merchant: "Coolblue", raw: "BEA COOLBLUE BV NIJMEGEN", cat: "vrijetijd", amount: -184.99 },
  { date: "21 mei", merchant: "Restaurant Toscana", raw: "BEA TOSCANA AMSTERDAM", cat: "vrijetijd", amount: -67.50 },
  { date: "20 mei", merchant: "Albert Heijn", raw: "BEA AH 1043 AMSTERDAM", cat: "boodschappen", amount: -58.30 },
  { date: "19 mei", merchant: "Shell", raw: "BEA SHELL STATION A2", cat: "vervoer", amount: -71.20 },
  { date: "18 mei", merchant: "NS Reizen", raw: "SEPA NS GROEP", cat: "vervoer", amount: -24.40 },
  { date: "17 mei", merchant: "MediaMarkt", raw: "BEA MEDIAMARKT", cat: "", amount: -42.00 },
  { date: "16 mei", merchant: "Zilveren Kruis", raw: "SEPA ZILVEREN KRUIS", cat: "verzekeringen", amount: -147.50 },
  { date: "15 mei", merchant: "Salaris Mediter BV", raw: "SEPA MEDITER BV SALARIS", cat: "inkomen", amount: 3340.00 },
];

function ImportView() {
  const [stage, setStage] = React.useState("idle"); // idle | parsing | done
  const [over, setOver] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const fileRef = React.useRef(null);

  function start(name) {
    setStage("parsing"); setProgress(0);
    let p = 0;
    const t = setInterval(() => {
      p += 8 + Math.random() * 14;
      if (p >= 100) { p = 100; clearInterval(t); setProgress(100); setTimeout(() => setStage("done"), 350); }
      setProgress(Math.min(100, p));
    }, 110);
  }
  function onDrop(e) { e.preventDefault(); setOver(false); start("bankexport.xlsx"); }

  const autoCount = IMPORT_SAMPLE.filter(r => r.cat).length;
  const uncatCount = IMPORT_SAMPLE.length - autoCount;

  return (
    <div className="content-inner fade-in" style={{ maxWidth: 940 }}>
      {stage !== "done" && (
        <div className="card card-pad" style={{ padding: 28 }}>
          <div className={"drop" + (over ? " over" : "")}
            onDragOver={e => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)} onDrop={onDrop}
            onClick={() => stage === "idle" && fileRef.current && fileRef.current.click()}
            style={{ cursor: stage === "idle" ? "pointer" : "default" }}>
            <div className="di"><img src="assets/icons/excel-document.svg" alt="" /></div>
            {stage === "idle" ? (
              <>
                <h2>Sleep je bankexport hierheen</h2>
                <p>Een Excel- of CSV-bestand van ING, Rabobank, ABN AMRO of bunq — wij lezen het in en categoriseren automatisch.</p>
                <button className="btn btn-primary" onClick={e => { e.stopPropagation(); start("bankexport.xlsx"); }}>
                  <Ic name="upload" size={16} /> Kies een bestand
                </button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={() => start("bankexport.xlsx")} />
                <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 22 }}>
                  <span className="chip"><Ic name="file" /> .xlsx</span>
                  <span className="chip"><Ic name="file" /> .csv</span>
                  <span className="chip"><Ic name="check" /> max 5 MB</span>
                </div>
              </>
            ) : (
              <>
                <h2>Bestand inlezen…</h2>
                <p>transacties.xlsx · {Math.round(progress)}%</p>
                <div className="bar" style={{ maxWidth: 320, margin: "0 auto", height: 8 }}>
                  <span style={{ width: progress + "%", background: "var(--blue)" }}></span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="fade-in">
          {/* summary */}
          <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 18 }}>
            <div className="card card-pad">
              <div className="k-lbl" style={{ marginBottom: 6 }}>Ingelezen</div>
              <div className="k-val tnum">{IMPORT_SAMPLE.length}</div>
              <div className="k-foot"><span className="delta-note">transacties · 1–22 mei 2026</span></div>
            </div>
            <div className="card card-pad">
              <div className="k-lbl" style={{ marginBottom: 6 }}>Automatisch ingedeeld</div>
              <div className="k-val tnum" style={{ color: "var(--pos)" }}>{autoCount}</div>
              <div className="k-foot"><span className="delta-note">{Math.round(autoCount / IMPORT_SAMPLE.length * 100)}% herkend</span></div>
            </div>
            <div className="card card-pad" style={{ background: "var(--orange-tint)", borderColor: "#F1DBCB" }}>
              <div className="k-lbl" style={{ marginBottom: 6 }}>Controle nodig</div>
              <div className="k-val tnum" style={{ color: "var(--orange)" }}>{uncatCount}</div>
              <div className="k-foot"><span className="delta-note">handmatig indelen</span></div>
            </div>
          </div>

          <div className="card">
            <div className="card-pad" style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--line)" }}>
              <div className="card-h" style={{ marginBottom: 0 }}><h3>Voorbeeld van de import</h3></div>
              <span className="chip" style={{ marginLeft: "auto" }}><Ic name="file" /> bankexport.xlsx</span>
            </div>
            <div style={{ padding: "8px 10px" }}>
              <table className="tbl">
                <thead><tr>
                  <th style={{ paddingLeft: 14 }}>Omschrijving (bank)</th><th>Datum</th><th>Herkende categorie</th><th style={{ textAlign: "right", paddingRight: 14 }}>Bedrag</th>
                </tr></thead>
                <tbody>
                  {IMPORT_SAMPLE.map((r, i) => (
                    <tr className="row" key={i} style={!r.cat ? { background: "var(--orange-tint)" } : null}>
                      <td style={{ width: "44%" }}>
                        <div className="mn">{r.merchant}</div>
                        <div className="md" style={{ fontFamily: "monospace", fontSize: 11.5, color: "var(--faint)" }}>{r.raw}</div>
                      </td>
                      <td className="tnum" style={{ color: "var(--muted)", fontWeight: 600 }}>{r.date}</td>
                      <td>{r.cat ? <CatTag catId={r.cat} small /> : <CatTag catId="" small />}</td>
                      <td className={"amt tnum " + (r.amount >= 0 ? "pos" : "neg")} style={{ paddingRight: 14 }}>{eurSign(r.amount, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 12, padding: "16px 22px", borderTop: "1px solid var(--line)", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Dit zijn de eerste regels — in totaal {IMPORT_SAMPLE.length} transacties klaar om toe te voegen.</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                <button className="btn" onClick={() => setStage("idle")}>Annuleren</button>
                <button className="btn btn-primary" onClick={() => setStage("idle")}><Ic name="check" size={16} /> Voeg toe aan overzicht</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* import history */}
      <div className="card card-pad" style={{ marginTop: 18 }}>
        <div className="card-h" style={{ marginBottom: 12 }}><h3>Eerdere imports</h3></div>
        {[
          { f: "ING_april_2026.xlsx", d: "1 mei 2026", n: 47 },
          { f: "ING_maart_2026.xlsx", d: "2 apr 2026", n: 52 },
          { f: "ING_februari_2026.xlsx", d: "3 mrt 2026", n: 44 },
        ].map((h, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < 2 ? "1px solid var(--line-soft)" : "0" }}>
            <span className="mi" style={{ background: "var(--blue-soft)", color: "var(--blue)", width: 34, height: 34, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}><Ic name="file" size={17} /></span>
            <div>
              <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 14 }}>{h.f}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{h.n} transacties · {h.d}</div>
            </div>
            <span className="tag" style={{ marginLeft: "auto", background: "var(--pos-soft)", color: "var(--pos)" }}><span className="dot" style={{ background: "var(--pos)" }}></span>Verwerkt</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { SavingsView, ImportView });
