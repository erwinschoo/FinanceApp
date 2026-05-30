import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useApp } from "../state/AppContext";
import { db } from "../db/schema";
import { eurSign, fmtDate } from "../lib/format";
import { parseFile } from "../import/sheetParser";
import { commitImport, assignPayeeCategory } from "../db/repo";
import { payeeKey } from "../helpers/payees";
import { CatTag } from "../components/CatTag";
import { CatSelect } from "../components/CatSelect";
import { Ic } from "../components/Ic";
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
      setStage("done");
    } catch (e) {
      setError("Inlezen mislukt: " + (e instanceof Error ? e.message : String(e)));
      setStage("idle");
    }
  }

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
  const uncatCount = newRows.length - autoCount;
  const dupCount = rows.length - newRows.length;
  const preview = rows.slice(0, 12);

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
            <button className="btn btn-ghost" style={{ padding: "3px 10px", color: "var(--blue)" }} onClick={() => setView("transacties")}>Bekijk transacties</button>
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
                <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
                  <Ic name="upload" size={16} /> Kies een bestand
                </button>
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
          <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 18 }}>
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
              <div className="card-h" style={{ marginBottom: 0 }}><h3>Voorbeeld van de import</h3></div>
              <span className="chip" style={{ marginLeft: "auto" }}><Ic name="file" /> {filename}</span>
            </div>
            <div style={{ padding: "8px 10px" }}>
              <table className="tbl">
                <thead><tr>
                  <th style={{ paddingLeft: 14 }}>Omschrijving (bank)</th><th>Datum</th><th>Herkende categorie</th><th style={{ textAlign: "right", paddingRight: 14 }}>Bedrag</th>
                </tr></thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr className="row" key={i} style={r.duplicate ? { opacity: 0.5 } : !r.category ? { background: "var(--orange-tint)" } : undefined}>
                      <td style={{ width: "44%" }}>
                        <div className="mn">{r.merchant}{r.duplicate ? " · al aanwezig" : ""}</div>
                        <div className="md" style={{ fontFamily: "monospace", fontSize: 11.5, color: "var(--faint)" }}>{r.rawDescription.slice(0, 52)}</div>
                      </td>
                      <td className="tnum" style={{ color: "var(--muted)", fontWeight: 600 }}>{fmtDate(r.date)}</td>
                      <td>
                        {r.duplicate || r.category === "inkomen" || r.category === "sparen"
                          ? <CatTag catId={r.category} small />
                          : <CatSelect value={r.category} onChange={(c) => changeRowCategory(r, c)} />}
                      </td>
                      <td className={"amt tnum " + (r.amount >= 0 ? "pos" : "neg")} style={{ paddingRight: 14 }}>{eurSign(r.amount, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 12, padding: "16px 22px", borderTop: "1px solid var(--line)", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                {preview.length < rows.length ? `Eerste ${preview.length} van ${rows.length} regels — ` : ""}{newRows.length} nieuwe transacties klaar om toe te voegen.
              </span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                <button className="btn" onClick={() => { setStage("idle"); setRows([]); }}>Annuleren</button>
                <button className="btn btn-primary" disabled={newRows.length === 0} onClick={commit}><Ic name="check" size={16} /> Voeg toe aan overzicht</button>
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
