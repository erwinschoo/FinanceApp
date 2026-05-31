import { useMemo, useState } from "react";
import { useApp } from "../state/AppContext";
import {
  addCategory, updateCategory, deleteCategory,
  addCategoryGroup, updateCategoryGroup, deleteCategoryGroup, setCategoryGroup,
  addRule, updateRule, deleteRule,
} from "../db/repo";
import { Ic } from "../components/Ic";
import { Dropdown } from "../components/Dropdown";
import { usePointerDragMove } from "../charts/usePointerDragMove";
import type { Category, CategoryGroupRow, CategoryType, RuleRow } from "../db/types";

/* Suggesties die "luisteren" met de rest: afgeleid van de huisstijl-tokens
 * (passen automatisch mee in dark mode). Daarnaast kan de gebruiker een
 * eigen kleur kiezen via de color picker (zie CatEditor). */
const COLORS = [
  "var(--blue)", "var(--orange)", "var(--pos)", "var(--cat-5)", "var(--cat-4)", "var(--cat-6)",
  "var(--warn)", "var(--over)", "#7A6FA8", "#5AA0A8", "#8A9A5B", "var(--cat-8)",
];
const TYPE_LABEL: Record<CategoryType, string> = { uitgave: "Uitgave", inkomen: "Inkomen", sparen: "Sparen", overboeking: "Overboeking" };

const byName = (a: Category, b: Category) => a.name.localeCompare(b.name, "nl");

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
  const { categories, categoryGroups, transactions } = useApp();
  const [editId, setEditId] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);     // groupId waar we een categorie aan toevoegen
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  // verslepen naar een andere groep — pointer-based (werkt op touch + muis, met auto-scroll)
  const { dragCat, dropGroup, startDrag } = usePointerDragMove({ onMove: setCategoryGroup });

  const usage = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of transactions) if (t.category) m[t.category] = (m[t.category] || 0) + 1;
    return m;
  }, [transactions]);

  const inGroup = (id: string) => categories.filter((c) => c.groupId === id).sort(byName);

  return (
    <div className="card card-pad">
      <div className="card-h" style={{ marginBottom: 14 }}>
        <h3>Categorieën</h3>
        <button className="btn" style={{ marginLeft: "auto" }} onClick={() => addCategoryGroup({ name: "Nieuwe groep" })}>
          <Ic name="plus" size={16} /> Nieuwe groep
        </button>
        <button className="btn btn-primary" onClick={() => { setAdding(categoryGroups[0]?.id ?? null); setEditId(null); }}>
          <Ic name="plus" size={16} /> Nieuwe categorie
        </button>
      </div>

      {adding && categoryGroups.length > 0 && (
        <CatEditor groups={categoryGroups} defaultGroupId={adding}
          onCancel={() => setAdding(null)} onSave={async (d) => { await addCategory(d); setAdding(null); }} />
      )}

      {categoryGroups.length === 0 && <div className="empty">Nog geen categoriegroepen.</div>}

      {categoryGroups.map((g) => {
        const members = inGroup(g.id);
        const isOver = dropGroup === g.id;
        return (
          <div key={g.id} data-group-id={g.id} className={"cat-group-sec" + (isOver ? " drag-over" : "")}>
            {editGroupId === g.id ? (
              <GroupEditor group={g} onCancel={() => setEditGroupId(null)}
                onSave={async (d) => { await updateCategoryGroup(g.id, d); setEditGroupId(null); }} />
            ) : (
              <div className="cat-group-h">
                <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 14.5 }}>{g.name}</div>
                <span style={{ fontSize: 12, color: "var(--faint)" }}>{members.length}</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
                  <button className="btn btn-ghost" style={{ padding: "5px 9px" }} title="Categorie toevoegen aan groep"
                    onClick={() => { setAdding(g.id); setEditId(null); }}><Ic name="plus" size={16} /></button>
                  <button className="btn btn-ghost" style={{ padding: "5px 9px" }} title="Groep bewerken"
                    onClick={() => setEditGroupId(g.id)}><Ic name="edit" size={16} /></button>
                  <button className="btn btn-ghost" style={{ padding: "5px 9px" }} title="Groep verwijderen"
                    onClick={() => removeGroup(g, members, categoryGroups)}><Ic name="trash" size={16} /></button>
                </div>
              </div>
            )}

            {members.length === 0 && (
              <div className="cat-empty-drop">Sleep hier categorieën naartoe of voeg er een toe.</div>
            )}
            {members.map((c) => (
              <CatRow key={c.id} c={c} groups={categoryGroups}
                usage={usage[c.id] || 0} editing={editId === c.id}
                isDragging={dragCat === c.id}
                onEdit={() => { setEditId(c.id); setAdding(null); }} onClose={() => setEditId(null)}
                onGripPointerDown={startDrag} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

async function removeGroup(g: CategoryGroupRow, members: Category[], groups: CategoryGroupRow[]) {
  const others = groups.filter((x) => x.id !== g.id);
  if (others.length === 0) { alert("Er moet minstens één categoriegroep overblijven."); return; }
  const target = others[0];
  const msg = members.length === 0
    ? `Groep "${g.name}" verwijderen?`
    : `${members.length} categorie(ën) verhuizen naar "${target.name}" en groep "${g.name}" verwijderen?`;
  if (confirm(msg)) await deleteCategoryGroup(g.id, target.id);
}

function CatRow({
  c, groups, usage, editing, isDragging,
  onEdit, onClose, onGripPointerDown,
}: {
  c: Category; groups: CategoryGroupRow[]; usage: number;
  editing: boolean; isDragging: boolean;
  onEdit: () => void; onClose: () => void;
  onGripPointerDown: (catId: string, e: React.PointerEvent) => void;
}) {
  async function remove() {
    const msg = usage > 0 ? `${usage} transactie(s) worden verplaatst naar "Overig". Doorgaan?` : `Categorie "${c.name}" verwijderen?`;
    if (confirm(msg)) await deleteCategory(c.id);
  }
  return (
    <div style={{ borderBottom: "1px solid var(--line-soft)" }}>
      <div className={"cat-row" + (isDragging ? " dragging" : "")}>
        <span className="cat-grip" title="Sleep naar een andere groep" onPointerDown={(e) => onGripPointerDown(c.id, e)}><Ic name="grip" size={16} /></span>
        <div className="cat-main">
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: c.color, flex: "none" }}></span>
          <div className="cat-name" style={{ fontWeight: 700, color: "var(--ink)", fontSize: 14 }}>{c.name}</div>
          <span className="tag" style={{ background: "var(--subtle)", color: "var(--muted)", fontSize: 11 }}>{TYPE_LABEL[c.type]}</span>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--muted)" }} className="tnum">{usage} transacties</span>
        <div className="cat-actions">
          <button className="btn btn-ghost" style={{ padding: "5px 9px" }} onClick={onEdit} title="Bewerken"><Ic name="edit" size={16} /></button>
          <button className="btn btn-ghost" style={{ padding: "5px 9px" }} onClick={remove} title="Verwijderen"><Ic name="trash" size={16} /></button>
        </div>
      </div>
      {editing && <CatEditor initial={c} groups={groups} onCancel={onClose} onSave={async (d) => { await updateCategory(c.id, d); onClose(); }} />}
    </div>
  );
}

/* Palet-kiezer (gedeeld door categorie- en groep-editor). */
function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const isCustom = !COLORS.includes(color);
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
      {COLORS.map((col) => (
        <button key={col} onClick={() => onChange(col)} title={col}
          style={{ width: 22, height: 22, borderRadius: "50%", background: col, border: color === col ? "2px solid var(--ink)" : "2px solid var(--surface)", boxShadow: "0 0 0 1px var(--line)", cursor: "pointer" }} />
      ))}
      <label title="Eigen kleur kiezen" style={{
        position: "relative", width: 22, height: 22, borderRadius: "50%", cursor: "pointer", display: "inline-flex",
        background: isCustom ? color : "conic-gradient(from 0deg, #e15b4c, #e0a23a, #4e8c7a, #5e81b5, #9a86be, #e15b4c)",
        border: isCustom ? "2px solid var(--ink)" : "2px solid var(--surface)", boxShadow: "0 0 0 1px var(--line)",
      }}>
        <input type="color" value={isCustom ? color : "#5E81B5"} onChange={(e) => onChange(e.target.value)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: 0, padding: 0 }} />
      </label>
    </div>
  );
}

function CatEditor({ initial, groups, defaultGroupId, onSave, onCancel }: {
  initial?: Category; groups: CategoryGroupRow[]; defaultGroupId?: string;
  onSave: (d: { name: string; color: string; type: CategoryType; groupId: string }) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [type, setType] = useState<CategoryType>(initial?.type ?? "uitgave");
  const [groupId, setGroupId] = useState(initial?.groupId ?? defaultGroupId ?? groups[0]?.id ?? "");
  return (
    <div className="editor-grid" style={{ background: "var(--subtle)", borderRadius: 12, padding: 16, margin: "4px 0 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Groep</label>
        <div style={{ marginTop: 6 }}>
          <Dropdown fullWidth ariaLabel="Groep" value={groupId} onChange={setGroupId}
            options={groups.map((g) => ({ value: g.id, label: g.name }))} />
        </div>
      </div>
      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Kleur</label>
        <ColorPicker color={color} onChange={setColor} />
      </div>
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="btn" onClick={onCancel}>Annuleren</button>
        <button className="btn btn-primary" onClick={() => onSave({ name, color, type, groupId })}><Ic name="check" size={16} /> Opslaan</button>
      </div>
    </div>
  );
}

function GroupEditor({ group, onSave, onCancel }: {
  group: CategoryGroupRow; onSave: (d: { name: string }) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(group.name);
  return (
    <div className="editor-grid" style={{ background: "var(--subtle)", borderRadius: 12, padding: 16, margin: "4px 0 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Groepsnaam</label>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
          style={{ display: "block", width: "100%", marginTop: 6, border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", fontSize: 14, outline: "none" }} />
      </div>
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="btn" onClick={onCancel}>Annuleren</button>
        <button className="btn btn-primary" onClick={() => onSave({ name })}><Ic name="check" size={16} /> Opslaan</button>
      </div>
    </div>
  );
}

/* ── Regels ── */
function RulesTab() {
  const { rules, categories, categoryGroups } = useApp();
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  // categorie-opties (gegroepeerd per categoriegroep) voor de gestylede Dropdown
  const catDropdownOptions = () =>
    categoryGroups.flatMap((g) =>
      categories.filter((c) => c.groupId === g.id).sort(byName)
        .map((c) => ({ value: c.id, label: c.name, color: c.color, group: g.name })),
    );

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
      <div className="tbl-wrap">
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
    </div>
  );
}
