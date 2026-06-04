import { useMemo } from "react";
import { useApp } from "../state/AppContext";
import { useProfile } from "../state/profile";
import { eur, monthKeyLabelFull } from "../lib/format";
import { txInMonth, spendByCat } from "../helpers/aggregations";
import { budgetColor } from "../helpers/budgetColor";
import { postForCategory } from "../nibud/mapping";
import {
  NIBUD_HOUSEHOLDS, NIBUD_POST_LABELS, NIBUD_POST_ORDER, NIBUD_YEAR,
  NIBUD_SOURCE_LABEL, NIBUD_SOURCE_URL, matchHousehold, compositionFrom,
} from "../nibud/referenceData";
import type { NibudPostId } from "../db/types";
import { Button } from "../components/Button";
import { Ic } from "../components/Ic";

export function Compare() {
  const { transactions, months, monthIdx, catMap, setView } = useApp();
  const profile = useProfile();
  const key = months[monthIdx];

  // Het actieve voorbeeldhuishouden: expliciete keuze in het profiel wint, anders auto-match.
  const household = useMemo(() => {
    if (!profile) return null;
    if (profile.nibudHouseholdId) {
      const chosen = NIBUD_HOUSEHOLDS.find((h) => h.id === profile.nibudHouseholdId);
      if (chosen) return chosen;
    }
    return matchHousehold(compositionFrom(profile.adults, profile.children), profile.incomeBand);
  }, [profile]);

  // Eigen uitgaven per Nibud-post: tel per categorie het maandbedrag op bij de gemapte post.
  const { mine, unmapped } = useMemo(() => {
    const mine: Record<string, number> = {};
    const unmapped: { name: string; amount: number }[] = [];
    const spend = spendByCat(txInMonth(transactions, key), catMap);
    for (const [catId, amount] of Object.entries(spend)) {
      const post = postForCategory(catId, profile);
      if (post) mine[post] = (mine[post] || 0) + amount;
      else if (amount > 0) unmapped.push({ name: catMap[catId]?.name ?? catId, amount });
    }
    unmapped.sort((a, b) => b.amount - a.amount);
    return { mine, unmapped };
  }, [transactions, key, catMap, profile]);

  if (profile === undefined) return <div className="empty">Laden…</div>;

  if (!profile || !household) {
    return (
      <div className="content-inner fade-in">
        <div className="card card-pad" style={{ textAlign: "center", padding: "44px 24px" }}>
          <div style={{ display: "inline-flex", marginBottom: 14, color: "var(--blue)" }}><Ic name="scale" size={34} /></div>
          <h3 style={{ margin: "0 0 6px" }}>Vergelijk met een vergelijkbaar huishouden</h3>
          <p style={{ color: "var(--muted)", maxWidth: 460, margin: "0 auto 18px" }}>
            Vul eerst je huishouden in op je profiel. Dan zet bokkiep je uitgaven af tegen de
            referentiecijfers van het Nibud voor een vergelijkbaar huishouden.
          </p>
          <Button variant="primary" icon="user" onClick={() => setView("profiel")}>Naar profiel</Button>
        </div>
      </div>
    );
  }

  const rows = NIBUD_POST_ORDER.map((post: NibudPostId) => {
    const ref = household.posts[post] ?? 0;
    const got = mine[post] ?? 0;
    const ratio = ref > 0 ? got / ref : got > 0 ? 1 : 0;
    return { post, ref, got, ratio };
  });
  const totalMine = rows.reduce((s, r) => s + r.got, 0);
  const totalRef = rows.reduce((s, r) => s + r.ref, 0);

  return (
    <div className="content-inner fade-in">
      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="card-h" style={{ marginBottom: 6 }}>
          <h3>Vergeleken met: {household.label}</h3>
          <span className="hint">{monthKeyLabelFull(key)}</span>
        </div>
        <p style={{ color: "var(--muted)", margin: 0, fontSize: 13.5 }}>
          Je uitgaven per categorie, afgezet tegen de Nibud-referentie voor dit huishoudtype.
          <span style={{ color: "var(--pos)", fontWeight: 600 }}> Groen</span> = onder de referentie,
          <span style={{ color: "var(--over)", fontWeight: 600 }}> rood</span> = erboven.
        </p>
      </div>

      <div className="card card-pad">
        <div className="cmp-row cmp-head">
          <div>Uitgavenpost</div>
          <div className="cmp-bar-col">Jij vs. referentie</div>
          <div className="tnum cmp-amt">Jij</div>
          <div className="tnum cmp-amt">Nibud</div>
        </div>

        {rows.map(({ post, ref, got, ratio }) => {
          const over = got > ref;
          return (
            <div className="cmp-row" key={post}>
              <div className="cmp-name">{NIBUD_POST_LABELS[post]}</div>
              <div className="cmp-bar-col">
                <div className="bar" style={{ height: 9 }}>
                  <span style={{ width: Math.min(100, ratio * 100) + "%", background: budgetColor(ratio) }}></span>
                </div>
                <div className="cmp-sub">
                  {ref > 0
                    ? <span style={{ color: over ? "var(--over)" : "var(--pos)", fontWeight: 400 }}>
                        {Math.round(ratio * 100)}% · {over ? `${eur(got - ref)} meer` : `${eur(ref - got)} minder`}
                      </span>
                    : <span style={{ color: "var(--muted)" }}>geen referentie</span>}
                </div>
              </div>
              <div className="tnum cmp-amt"><b style={{ fontWeight: 400 }}>{eur(got)}</b></div>
              <div className="tnum cmp-amt" style={{ color: "var(--muted)" }}>{eur(ref)}</div>
            </div>
          );
        })}

        <div className="cmp-row cmp-total">
          <div className="cmp-name" style={{ fontWeight: 800 }}>Totaal</div>
          <div className="cmp-bar-col" style={{ color: "var(--muted)", fontSize: 13 }}>
            {totalMine > totalRef
              ? <span style={{ color: "var(--over)", fontWeight: 700 }}>{eur(totalMine - totalRef)} boven referentie</span>
              : <span style={{ color: "var(--pos)", fontWeight: 700 }}>{eur(totalRef - totalMine)} onder referentie</span>}
          </div>
          <div className="tnum cmp-amt"><b>{eur(totalMine)}</b></div>
          <div className="tnum cmp-amt" style={{ color: "var(--muted)" }}>{eur(totalRef)}</div>
        </div>
      </div>

      {unmapped.length > 0 && (
        <div className="card card-pad" style={{ marginTop: 18 }}>
          <div className="card-h" style={{ marginBottom: 8 }}>
            <h3>Niet vergeleken</h3>
            <span className="hint">geen Nibud-post gekoppeld</span>
          </div>
          <p style={{ color: "var(--muted)", margin: "0 0 10px", fontSize: 13 }}>
            Deze categorieën tellen niet mee in de vergelijking. Koppel ze aan een Nibud-post op je{" "}
            <button className="lnk" onClick={() => setView("profiel")}>profiel</button>.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {unmapped.map((u) => (
              <span key={u.name} className="chip" style={{ fontSize: 12.5 }}>{u.name} · {eur(u.amount)}</span>
            ))}
          </div>
        </div>
      )}

      <p style={{ color: "var(--faint)", fontSize: 12, marginTop: 16, lineHeight: 1.5 }}>
        Referentiecijfers: {NIBUD_SOURCE_LABEL} {NIBUD_YEAR} (indicatief, voorbeeldhuishouden — geen exacte norm).{" "}
        <a href={NIBUD_SOURCE_URL} target="_blank" rel="noopener noreferrer">Bron</a>
      </p>
    </div>
  );
}
