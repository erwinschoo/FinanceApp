import { useMemo, useState } from "react";
import { useApp } from "../state/AppContext";
import {
  addCategory, updateCategory, deleteCategory,
  addRule, updateRule, deleteRule,
} from "../db/repo";
import { Ic } from "../components/Ic";
import { Dropdown } from "../components/Dropdown";
import type { Category, CategoryType, RuleRow } from "../db/types";

/* Suggesties die "luisteren" met de rest: afgeleid van de huisstijl-tokens
 * (passen automatisch mee in dark mode). Daarnaast kan de gebruiker een
 * eigen kleur kiezen via de color picker (zie CatEditor). */
const COLORS = [
  "var(--blue)", "var(--orange)", "var(--pos)", "var(--cat-5)", "var(--cat-4)", "var(--cat-6)",
  "var(--warn)", "var(--over)", "#7A6FA8", "#5AA0A8", "#8A9A5B", "var(--cat-8)",
];
const TYPE_LABEL: Record<CategoryType, string> = { uitgave: "Uitgave", inkomen: "Inkomen", sparen: "Sparen", overboeking: "Overboeking" };

export function Manage() {
  const [tab, setTab] = useState<"cats" | "rules">("cats");
  return (
    <div className="content-inner fade-in" style={{ maxWidth: 920 }}>
      <div className="seg" style={{ marginBottom: 18 }}>
        <button className={tab === "cats" ? "on" : ""} onClick={() => setTab("cats")}>Categorieën</button>
        <button className={tab === "rules" ? "on" : ""} onClick={() => setTab("rules")}>Regels</button>
      </div>
      {tab === "cats" ? <CategoriesTab /> : <RulesTab />}
    </div>
  );
}

/* ── Categorieën ── */
function CategoriesTab() {
  const { categories, transactions } = useApp();
  const [editId, setEditId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const usage = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of transactions) if (t.category) m[t.category] = (m[t.category] || 0) + 1;
    return m;
  }, [transactions]);

  const byName = (a: Category, b: Category) => a.name.localeCompare(b.name, "nl");
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id).sort(byName);
  const topLevel = categories.filter((c) => !c.parentId).sort(byName);
  const parents = topLevel; // mogelijke groepen (max 2 niveaus)

  return (
    <div className="card card-pad">
      <div className="card-h" style={{ marginBottom: 14 }}>
        <h3>Categorieën</h3>
        <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={() => { setAdding(true); setEditId(null); }}>
          <Ic name="plus" size={16} /> Nieuwe categorie
        </button>
      </div>

      {adding && <CatEditor parents={parents} onCancel={() => setAdding(false)} onSave={async (d) => { await addCategory(d); setAdding(false); }} />}

      <div>
        {topLevel.map((top) => {
          const kids = childrenOf(top.id);
          return (
            <div key={top.id}>
              <CatRow c={top} usage={usage[top.id] || 0} childCount={kids.length} editing={editId === top.id}
                parents={parents} onEdit={() => { setEditId(top.id); setAdding(false); }} onClose={() => setEditId(null)} />
              {kids.map((k) => (
                <CatRow key={k.id} c={k} indent usage={usage[k.id] || 0} childCount={0}
                  editing={editId === k.id} parents={parents} onEdit={() => { setEditId(k.id); setAdding(false); }} onClose={() => setEditId(null)} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CatRow({ c, usage, childCount, indent, editing, parents, onEdit, onClose }: {
  c: Category; usage: number; childCount: number; indent?: boolean; editing: boolean;
  parents: Category[]; onEdit: () => void; onClose: () => void;
}) {
  async function remove() {
    if (childCount > 0) { alert("Verplaats of verwijder eerst de subcategorieën."); return; }
    const msg = usage > 0 ? `${usage} transactie(s) worden verplaatst naar "Overig". Doorgaan?` : `Categorie "${c.name}" verwijderen?`;
    if (confirm(msg)) await deleteCategory(c.id);
  }
  return (
    <div style={{ borderBottom: "1px solid var(--line-soft)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 0", paddingLeft: indent ? 20 : 0 }}>
        <span style={{ width: 11, height: 11, borderRadius: childCount ? 3 : "50%", background: c.color, flex: "none" }}></span>
        <div style={{ fontWeight: childCount ? 800 : 700, color: "var(--ink)", fontSize: 14 }}>{c.name}</div>
        <span className="tag" style={{ background: "var(--subtle)", color: "var(--muted)", fontSize: 11 }}>{TYPE_LABEL[c.type]}</span>
        {childCount > 0 && <span style={{ fontSize: 12, color: "var(--faint)" }}>{childCount} sub</span>}
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--muted)" }} className="tnum">{usage} transacties</span>
        <button className="btn btn-ghost" style={{ padding: "5px 9px" }} onClick={onEdit} title="Bewerken"><Ic name="edit" size={16} /></button>
        <button className="btn btn-ghost" style={{ padding: "5px 9px" }} onClick={remove} title="Verwijderen"><Ic name="trash" size={16} /></button>
      </div>
      {editing && <CatEditor initial={c} parents={parents} onCancel={onClose} onSave={async (d) => { await updateCategory(c.id, d); onClose(); }} />}
    </div>
  );
}

function CatEditor({ initial, parents, onSave, onCancel }: {
  initial?: Category; parents: Category[];
  onSave: (d: { name: string; color: string; type: CategoryType; parentId: string | null }) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [type, setType] = useState<CategoryType>(initial?.type ?? "uitgave");
  const [parentId, setParentId] = useState<string | null>(initial?.parentId ?? null);
  const selectableParents = parents.filter((p) => p.id !== initial?.id);
  const isCustom = !COLORS.includes(color); // gekozen kleur valt buiten de suggesties
  return (
    <div style={{ background: "var(--subtle)", borderRadius: 12, padding: 16, margin: "4px 0 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Naam</label>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
          style={{ display: "block", width: "100%", marginTop: 6, border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", fontSize: 14, outline: "none" }} />
      </div>
      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Type</label>
        <div style={{ marginTop: 6 }}>
          <Dropdown fullWidth ariaLabel="Type" value={type} onChange={(v) => setType(v as CategoryType)}
            options={(["uitgave", "inkomen", "sparen", "overboeking"] as CategoryType[]).map((t) => ({ value: t, label: TYPE_LABEL[t] }))} />
        </div>
      </div>
      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Hoofdgroep</label>
        <div style={{ marginTop: 6 }}>
          <Dropdown fullWidth ariaLabel="Hoofdgroep" value={parentId ?? ""} onChange={(v) => setParentId(v || null)}
            options={[{ value: "", label: "— geen (hoofdcategorie) —" }, ...selectableParents.map((p) => ({ value: p.id, label: p.name, color: p.color }))]} />
        </div>
      </div>
      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Kleur</label>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
          {COLORS.map((col) => (
            <button key={col} onClick={() => setColor(col)} title={col}
              style={{ width: 22, height: 22, borderRadius: "50%", background: col, border: color === col ? "2px solid var(--ink)" : "2px solid var(--surface)", boxShadow: "0 0 0 1px var(--line)", cursor: "pointer" }} />
          ))}
          {/* eigen kleur kiezen */}
          <label title="Eigen kleur kiezen" style={{
            position: "relative", width: 22, height: 22, borderRadius: "50%", cursor: "pointer", display: "inline-flex",
            background: isCustom ? color : "conic-gradient(from 0deg, #e15b4c, #e0a23a, #4e8c7a, #5e81b5, #9a86be, #e15b4c)",
            border: isCustom ? "2px solid var(--ink)" : "2px solid var(--surface)", boxShadow: "0 0 0 1px var(--line)",
          }}>
            <input type="color" value={isCustom ? color : "#5E81B5"} onChange={(e) => setColor(e.target.value)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: 0, padding: 0 }} />
          </label>
        </div>
      </div>
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="btn" onClick={onCancel}>Annuleren</button>
        <button className="btn btn-primary" onClick={() => onSave({ name, color, type, parentId })}><Ic name="check" size={16} /> Opslaan</button>
      </div>
    </div>
  );
}

/* ── Regels ── */
function RulesTab() {
  const { rules, categories } = useApp();
  const byName = (a: Category, b: Category) => a.name.localeCompare(b.name, "nl");
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  // categorie-opties (gegroepeerd) voor de gestylede Dropdown
  const tops = categories.filter((c) => !c.parentId).sort(byName);
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id).sort(byName);
  const catDropdownOptions = () =>
    tops.flatMap((t) => {
      const kids = childrenOf(t.id);
      if (kids.length === 0) return [{ value: t.id, label: t.name, color: t.color }];
      return kids.map((k) => ({ value: k.id, label: k.name, color: k.color, group: t.name }));
    });

  const sel = { border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px", fontSize: 13, background: "var(--surface)" } as const;

  return (
    <div className="card card-pad">
      <div className="card-h" style={{ marginBottom: 6 }}>
        <h3>Categoriseer-regels</h3>
        <button className="btn btn-primary" style={{ marginLeft: "auto" }}
          onClick={() => addRule({ field: "rawDescription", pattern: "", matchType: "contains", categoryId: "overig", priority: 50 })}>
          <Ic name="plus" size={16} /> Nieuwe regel
        </button>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0 }}>
        Regels vullen automatisch een categorie in bij import. Een toewijzing per tegenpartij wint altijd van een regel. Lagere prioriteit = eerst toegepast.
      </p>
      <table className="tbl">
        <thead><tr>
          <th style={{ paddingLeft: 0 }}>Veld</th><th>Type</th><th>Patroon (tekst)</th><th>Categorie</th><th style={{ width: 70 }}>Prio</th><th></th>
        </tr></thead>
        <tbody>
          {sorted.length === 0 && <tr><td colSpan={6}><div className="empty">Nog geen regels.</div></td></tr>}
          {sorted.map((r: RuleRow) => (
            <tr key={r.id}>
              <td style={{ paddingLeft: 0 }}>
                <Dropdown fullWidth ariaLabel="Veld" value={r.field}
                  onChange={(v) => updateRule(r.id, { field: v as RuleRow["field"] })}
                  options={[{ value: "rawDescription", label: "Omschrijving" }, { value: "merchant", label: "Naam (merchant)" }]} />
              </td>
              <td>
                <Dropdown fullWidth ariaLabel="Type" value={r.matchType}
                  onChange={(v) => updateRule(r.id, { matchType: v as RuleRow["matchType"] })}
                  options={[{ value: "contains", label: "bevat" }, { value: "regex", label: "regex" }]} />
              </td>
              <td>
                <input defaultValue={r.pattern} onBlur={(e) => updateRule(r.id, { pattern: e.target.value })} placeholder="bijv. ALBERT HEIJN"
                  style={{ ...sel, width: "100%", minWidth: 160 }} />
              </td>
              <td>
                <Dropdown fullWidth ariaLabel="Categorie" value={r.categoryId} minWidth={210}
                  onChange={(v) => updateRule(r.id, { categoryId: v })}
                  options={catDropdownOptions()} />
              </td>
              <td>
                <input type="number" defaultValue={r.priority} onBlur={(e) => updateRule(r.id, { priority: Number(e.target.value) || 50 })}
                  className="tnum" style={{ ...sel, width: 60 }} />
              </td>
              <td style={{ textAlign: "right" }}>
                <button className="btn btn-ghost" style={{ padding: "5px 9px" }} title="Verwijderen" onClick={() => deleteRule(r.id)}><Ic name="trash" size={16} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
