import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useApp } from "../state/AppContext";
import { db } from "../db/schema";
import { eurSign, fmtDate } from "../lib/format";
import { parseFile } from "../import/sheetParser";
import { onIncomingFile } from "../import/incoming";
import { commitImport, assignPayeeCategory } from "../db/repo";
import { payeeKey } from "../helpers/payees";
import { CatTag } from "../components/CatTag";
import { CatSelect } from "../components/CatSelect";
import { Ic } from "../components/Ic";
import { Button } from "../components/Button";
import excelDoc from "../assets/excel-document.svg";
import type { ParsedRow } from "../db/types";

type Stage = "idle" | "parsing" | "done";

export function Import() {
  const { rules, setView } = useApp();
  const [stage, setStage] = useState<Stage>("idle");
  const [over, setOver] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const [added, setAdded] = useState<number | null>(null);
  // tegenpartijen die in de preview handmatig zijn ingedeeld → mapping opslaan bij toevoegen
  const [manual, setManual] = useState<Map<string, { cat: string; counterIban: string; merchant: string }>>(new Map());
  const [filterUncat, setFilterUncat] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE = 25;
  const fileRef = useRef<HTMLInputElement>(null);

  const history = useLiveQuery(
    () => db.importBatches.orderBy("importedAt").reverse().toArray(),
    [],
    [],
  );

  async function handleFile(file: File) {
    setStage("parsing");
    setError("");
    setFilename(file.name);
    setAdded(null);
    try {
      const parsed = await parseFile(file, rules);
      if (parsed.length === 0) {
        setError("Geen herkenbare transacties gevonden. Controleer of dit een ING-export (CSV/Excel) is.");
        setStage("idle");
        return;
      }
      setRows(parsed);
      setPage(0);
      setFilterUncat(true);
      setStage("done");
    } catch (e) {
      setError("Inlezen mislukt: " + (e instanceof Error ? e.message : String(e)));
      setStage("idle");
    }
  }

  // Geopend via "openen met"/de deel-knop (zie App.tsx + import/incoming.ts): zodra een bestand wordt
  // aangeboden, meteen inlezen en de preview tonen. Abonnement wordt bij unmount opgeruimd.
  useEffect(() => {
    return onIncomingFile((file) => void handleFile(file));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  // Categorie in de preview wijzigen: pas toe op ALLE regels van dezelfde tegenpartij
  // (IBAN indien aanwezig, anders winkelnaam) en onthoud de keuze als mapping.
  function changeRowCategory(row: ParsedRow, cat: string) {
    const key = payeeKey(row);
    setRows((prev) => prev.map((x) => (payeeKey(x) === key ? { ...x, category: cat } : x)));
    setManual((prev) => {
      const m = new Map(prev);
      m.set(key, { cat, counterIban: row.counterIban, merchant: row.merchant });
      return m;
    });
  }

  async function commit() {
    const n = await commitImport(rows, filename);
    // bewaar mappings voor handmatig ingedeelde tegenpartijen (geldt ook voor toekomstige imports)
    for (const { cat, counterIban, merchant } of manual.values()) {
      await assignPayeeCategory({ counterIban, merchant }, cat);
    }
    setManual(new Map());
    setAdded(n);
    setRows([]);
    setStage("idle");
  }

  const newRows = rows.filter((r) => !r.duplicate);
  const autoCount = newRows.filter((r) => r.category).length;
  const uncatCount = newRows.length - autoCount; // = resterend in te delen
  const dupCount = rows.length - newRows.length;

  // werklijst: niet-ingedeeld (non-dup) eerst, dan ingedeeld, dan duplicaten; daarbinnen nieuwste eerst
  const rank = (r: ParsedRow) => (r.duplicate ? 2 : r.category ? 1 : 0);
  const sorted = [...rows].sort((a, b) => rank(a) - rank(b) || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const filtered = filterUncat ? sorted.filter((r) => !r.duplicate && !r.category) : sorted;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pageCount - 1);
  const visible = filtered.slice(cur * PAGE, cur * PAGE + PAGE);

  function assignRestToOverig() {
    setRows((prev) => prev.map((r) => (!r.duplicate && !r.category ? { ...r, category: "overig" } : r)));
  }

  return (
    <div className="content-inner fade-in" style={{ maxWidth: 940 }}>
      {error && (
        <div className="notice" style={{ marginBottom: 18, background: "var(--over-soft)", borderColor: "#F3D9D5" }}>
          <span className="ni" style={{ color: "var(--over)" }}><Ic name="info" size={20} /></span>
          <div className="nt">{error}</div>
        </div>
      )}
      {added != null && (
        <div className="notice" style={{ marginBottom: 18, background: "var(--pos-soft)", borderColor: "#CFE6DD" }}>
          <span className="ni" style={{ color: "var(--pos)" }}><Ic name="check" size={20} /></span>
          <div className="nt"><b>{added} transactie{added === 1 ? "" : "s"} toegevoegd.</b>{" "}
            <Button variant="ghost" style={{ padding: "3px 10px", color: "var(--blue)" }} onClick={() => setView("transacties")}>Bekijk transacties</Button>
          </div>
        </div>
      )}

      {stage !== "done" && (
        <div className="card card-pad" style={{ padding: 28 }}>
          <div className={"drop" + (over ? " over" : "")}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)} onDrop={onDrop}
            onClick={() => stage === "idle" && fileRef.current?.click()}
            style={{ cursor: stage === "idle" ? "pointer" : "default" }}>
            <div className="di"><img src={excelDoc} alt="" /></div>
            {stage === "idle" ? (
              <>
                <h2>Sleep je bankexport hierheen</h2>
                <p>Een Excel- of CSV-bestand van ING — wij lezen het in, categoriseren automatisch en slaan duplicaten over.</p>
                <Button variant="primary" icon="upload" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
                  Kies een bestand
                </Button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
                <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 22 }}>
                  <span className="chip"><Ic name="file" /> .xlsx</span>
                  <span className="chip"><Ic name="file" /> .csv</span>
                  <span className="chip"><Ic name="check" /> ING-formaat</span>
                </div>
              </>
            ) : (
              <>
                <h2>Bestand inlezen…</h2>
                <p>{filename}</p>
                <div className="bar" style={{ maxWidth: 320, margin: "0 auto", height: 8 }}>
                  <span style={{ width: "70%", background: "var(--blue)" }}></span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="fade-in">
          <div className="grid grid-kpi" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 18 }}>
            <div className="card card-pad">
              <div className="k-lbl" style={{ marginBottom: 6 }}>Nieuw</div>
              <div className="k-val tnum">{newRows.length}</div>
              <div className="k-foot"><span className="delta-note">transacties</span></div>
            </div>
            <div className="card card-pad">
              <div className="k-lbl" style={{ marginBottom: 6 }}>Automatisch ingedeeld</div>
              <div className="k-val tnum" style={{ color: "var(--pos)" }}>{autoCount}</div>
              <div className="k-foot"><span className="delta-note">{newRows.length ? Math.round((autoCount / newRows.length) * 100) : 0}% herkend</span></div>
            </div>
            <div className="card card-pad" style={{ background: "var(--orange-tint)", borderColor: "#F1DBCB" }}>
              <div className="k-lbl" style={{ marginBottom: 6 }}>Controle nodig</div>
              <div className="k-val tnum" style={{ color: "var(--orange)" }}>{uncatCount}</div>
              <div className="k-foot"><span className="delta-note">handmatig indelen</span></div>
            </div>
            <div className="card card-pad">
              <div className="k-lbl" style={{ marginBottom: 6 }}>Duplicaten</div>
              <div className="k-val tnum" style={{ color: "var(--muted)" }}>{dupCount}</div>
              <div className="k-foot"><span className="delta-note">overgeslagen</span></div>
            </div>
          </div>

          <div className="card">
            <div className="card-pad" style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--line)" }}>
              <div className="card-h" style={{ marginBottom: 0 }}><h3>Controleer en deel in</h3></div>
              <span className="chip" style={{ marginLeft: "auto" }}><Ic name="file" /> {filename}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--body)", cursor: "pointer" }}>
                <input type="checkbox" checked={filterUncat} onChange={(e) => { setFilterUncat(e.target.checked); setPage(0); }} style={{ accentColor: "var(--blue)", width: 16, height: 16 }} />
                Alleen controle nodig
              </label>
              <span style={{ fontSize: 13, color: "var(--muted)" }} className="tnum">{autoCount} van {newRows.length} ingedeeld{uncatCount > 0 ? ` · ${uncatCount} te gaan` : " ✓"}</span>
              {pageCount > 1 && (
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                  <Button variant="ghost" iconOnly icon="chevronLeft" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Vorige pagina" />
                  <span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", minWidth: 84, textAlign: "center" }}>pagina {cur + 1} / {pageCount}</span>
                  <Button variant="ghost" iconOnly icon="chevronRight" disabled={cur >= pageCount - 1} onClick={() => setPage(cur + 1)} aria-label="Volgende pagina" />
                </div>
              )}
            </div>
            <div style={{ padding: "8px 10px" }}>
              <table className="tbl tbl-cards">
                <thead><tr>
                  <th style={{ paddingLeft: 14 }}>Omschrijving (bank)</th><th>Datum</th><th>Herkende categorie</th><th style={{ textAlign: "right", paddingRight: 14 }}>Bedrag</th>
                </tr></thead>
                <tbody>
                  {visible.length === 0 && (
                    <tr><td colSpan={4}><div className="empty">{filterUncat ? "Alles ingedeeld ✓" : "Geen regels."}</div></td></tr>
                  )}
                  {visible.map((r) => (
                    <tr className="row" key={r.dedupeHash} style={r.duplicate ? { opacity: 0.5 } : !r.category ? { background: "var(--orange-tint)" } : undefined}>
                      <td className="td-primary" style={{ width: "44%" }}>
                        <div className="mn">{r.merchant}{r.duplicate ? " · al aanwezig" : ""}</div>
                        <div className="md" style={{ fontFamily: "monospace", fontSize: 11.5, color: "var(--faint)" }}>{r.rawDescription.slice(0, 52)}</div>
                      </td>
                      <td className="tnum" style={{ color: "var(--muted)", fontWeight: 600 }} data-label="Datum">{fmtDate(r.date)}</td>
                      <td data-label="Categorie">
                        {r.duplicate || r.category === "inkomen" || r.category === "sparen"
                          ? <CatTag catId={r.category} small />
                          : <CatSelect value={r.category} onChange={(c) => changeRowCategory(r, c)} />}
                      </td>
                      <td className={"amt tnum " + (r.amount >= 0 ? "pos" : "neg")} style={{ paddingRight: 14 }} data-label="Bedrag">{eurSign(r.amount, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="import-actions" style={{ display: "flex", gap: 12, padding: "16px 22px", borderTop: "1px solid var(--line)", alignItems: "center", flexWrap: "wrap" }}>
              {uncatCount > 0 ? (
                <span style={{ fontSize: 13, color: "var(--orange)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Ic name="info" size={16} /> <b>{uncatCount}</b> nog niet ingedeeld
                  <Button variant="ghost" style={{ padding: "3px 10px", color: "var(--blue)", marginLeft: 6 }} onClick={assignRestToOverig}>Zet resterende op Overig</Button>
                </span>
              ) : (
                <span style={{ fontSize: 13, color: "var(--pos)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Ic name="check" size={16} /> Alles ingedeeld — {newRows.length} transacties klaar
                </span>
              )}
              <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                <Button onClick={() => { setStage("idle"); setRows([]); }}>Annuleren</Button>
                <Button variant="primary" icon="check" disabled={newRows.length === 0} onClick={commit}>
                  Voeg {newRows.length} toe aan overzicht
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card card-pad" style={{ marginTop: 18 }}>
        <div className="card-h" style={{ marginBottom: 12 }}><h3>Eerdere imports</h3></div>
        {history.length === 0 ? (
          <div className="empty">Nog geen imports.</div>
        ) : (
          history.map((h, i) => (
            <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < history.length - 1 ? "1px solid var(--line-soft)" : "0" }}>
              <span className="mi" style={{ background: "var(--blue-soft)", color: "var(--blue)", width: 34, height: 34, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}><Ic name="file" size={17} /></span>
              <div>
                <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 14 }}>{h.filename}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{h.count} transacties · {new Date(h.importedAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}</div>
              </div>
              <span className="tag" style={{ marginLeft: "auto", background: "var(--pos-soft)", color: "var(--pos)" }}><span className="dot" style={{ background: "var(--pos)" }}></span>Verwerkt</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
