import { useEffect, useRef, useState } from "react";
import { useApp } from "../state/AppContext";
import { useProfile, saveProfile, DEFAULT_PROFILE } from "../state/profile";
import { useTheme } from "../state/useTheme";
import { Dropdown, type DropdownOption } from "../components/Dropdown";
import { Ic } from "../components/Ic";
import {
  NIBUD_HOUSEHOLDS, NIBUD_POST_LABELS, NIBUD_POST_ORDER, NIBUD_YEAR,
  NIBUD_SOURCE_LABEL, NIBUD_SOURCE_URL, matchHousehold, compositionFrom,
} from "../nibud/referenceData";
import { DEFAULT_NIBUD_MAPPING } from "../nibud/mapping";
import type { HouseholdProfile, IncomeBand, NibudPostId } from "../db/types";

const INCOME_LABELS: Record<IncomeBand, string> = {
  "minimum": "Minimuminkomen",
  "modaal": "Modaal inkomen",
  "twee-modaal": "Twee keer modaal",
};

export function Profile() {
  const { categories, hasImportedBalance, derivedStartBalance, startBalanceKnown, focusTarget } = useApp();
  const stored = useProfile();
  const { theme, toggle } = useTheme();

  // Scroll/flits naar de beginsaldo-kaart wanneer de gebruiker via de banner hierheen komt.
  const balCardRef = useRef<HTMLDivElement>(null);
  const [flashBal, setFlashBal] = useState(false);
  useEffect(() => {
    if (focusTarget !== "beginsaldo" || !balCardRef.current) return;
    balCardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashBal(true);
    const t = setTimeout(() => setFlashBal(false), 1600);
    return () => clearTimeout(t);
  }, [focusTarget]);

  // Werk-kopie: bij eerste render afgeleid van wat in de DB staat (of de default).
  const [p, setP] = useState<HouseholdProfile>(() => stored ?? DEFAULT_PROFILE);
  // Vrij in te typen tekstwaarde voor het beginsaldo (los van de centen-opslag).
  const [balStr, setBalStr] = useState<string>(() => centsToInput(stored?.startBalanceCents));
  // Synchroniseer eenmalig wanneer de opgeslagen waarde binnenkomt (bv. na sync/refresh).
  const [hydrated, setHydrated] = useState(false);
  if (!hydrated && stored) { setP(stored); setBalStr(centsToInput(stored.startBalanceCents)); setHydrated(true); }
  if (!hydrated && stored === null) setHydrated(true);

  function update(patch: Partial<HouseholdProfile>) {
    setP((prev) => {
      const next = { ...prev, ...patch };
      void saveProfile(next);
      return next;
    });
  }

  const matched = matchHousehold(compositionFrom(p.adults, p.children), p.incomeBand);
  const household = p.nibudHouseholdId
    ? NIBUD_HOUSEHOLDS.find((h) => h.id === p.nibudHouseholdId) ?? matched
    : matched;

  const adultOpts: DropdownOption[] = [{ value: "1", label: "1 volwassene" }, { value: "2", label: "2 volwassenen" }];
  const childOpts: DropdownOption[] = [0, 1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: n === 1 ? "1 kind" : `${n} kinderen` }));
  const incomeOpts: DropdownOption[] = (Object.keys(INCOME_LABELS) as IncomeBand[]).map((v) => ({ value: v, label: INCOME_LABELS[v] }));
  const housingOpts: DropdownOption[] = [{ value: "huur", label: "Huurwoning" }, { value: "koop", label: "Koopwoning" }];
  const carOpts: DropdownOption[] = [{ value: "0", label: "Geen auto" }, { value: "1", label: "Eén of meer auto's" }];
  const householdOpts: DropdownOption[] = [
    { value: "", label: `Automatisch (${matched.label})` },
    ...NIBUD_HOUSEHOLDS.map((h) => ({ value: h.id, label: h.label })),
  ];

  const expenseCats = categories.filter((c) => c.type === "uitgave").sort((a, b) => a.name.localeCompare(b.name, "nl"));

  return (
    <div className="content-inner fade-in">
      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="card-h" style={{ marginBottom: 4 }}>
          <h3>Huishouden</h3>
        </div>
        <p style={{ color: "var(--muted)", margin: "0 0 16px", fontSize: 13.5 }}>
          Op basis hiervan kiezen we een vergelijkbaar Nibud-voorbeeldhuishouden om je uitgaven tegen af te zetten.
        </p>

        <div className="prof-grid">
          <Field label="Volwassenen">
            <Dropdown fullWidth ariaLabel="Volwassenen" value={String(p.adults)} options={adultOpts}
              onChange={(v) => update({ adults: Number(v) })} />
          </Field>
          <Field label="Kinderen">
            <Dropdown fullWidth ariaLabel="Kinderen" value={String(p.children)} options={childOpts}
              onChange={(v) => update({ children: Number(v) })} />
          </Field>
          <Field label="Inkomen">
            <Dropdown fullWidth ariaLabel="Inkomen" value={p.incomeBand} options={incomeOpts}
              onChange={(v) => update({ incomeBand: v as IncomeBand })} />
          </Field>
          <Field label="Woning">
            <Dropdown fullWidth ariaLabel="Woning" value={p.housing} options={housingOpts}
              onChange={(v) => update({ housing: v as "huur" | "koop" })} />
          </Field>
          <Field label="Auto">
            <Dropdown fullWidth ariaLabel="Auto" value={p.hasCar ? "1" : "0"} options={carOpts}
              onChange={(v) => update({ hasCar: v === "1" })} />
          </Field>
          <Field label="Referentiehuishouden">
            <Dropdown fullWidth ariaLabel="Referentiehuishouden" value={p.nibudHouseholdId ?? ""} options={householdOpts}
              onChange={(v) => update({ nibudHouseholdId: v || undefined })} />
          </Field>
        </div>

        <div className="prof-match">
          <Ic name="scale" size={18} />
          <span>Je wordt vergeleken met: <b>{household.label}</b></span>
        </div>
      </div>

      <div ref={balCardRef} className="card card-pad" style={{
        marginBottom: 18,
        ...(startBalanceKnown ? null : { border: "1px solid var(--orange)" }),
        ...(flashBal ? { boxShadow: "0 0 0 3px var(--orange-soft)" } : null),
      }}>
        <div className="card-h" style={{ marginBottom: 4 }}>
          <h3>Beginsaldo</h3>
        </div>
        {hasImportedBalance ? (
          <>
            <p style={{ color: "var(--muted)", margin: "0 0 16px", fontSize: 13.5 }}>
              Automatisch overgenomen uit je import: bokkiep rekent met het echte banksaldo, dus je hoeft hier niets in te vullen.
            </p>
            <label className="prof-field" style={{ maxWidth: 220 }}>
              <span className="prof-field-lbl">Beginsaldo (€)</span>
              <input
                type="text" value={derivedStartBalance != null ? eurInput(derivedStartBalance) : "—"} disabled readOnly
                aria-label="Beginsaldo betaalrekening (uit import)"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--subtle)", color: "var(--muted)", fontSize: 14, marginTop: 8 }}
              />
            </label>
          </>
        ) : (
          <>
            <p style={{ color: "var(--muted)", margin: "0 0 16px", fontSize: 13.5 }}>
              Het saldo waarmee het overzicht begint te rekenen. Je import levert (nog) geen banksaldo mee, dus vul je startsaldo hier zelf in — zodra een import wél een banksaldo bevat, neemt dat het over.
            </p>
            <label className="prof-field" style={{ maxWidth: 220 }}>
              <span className="prof-field-lbl">Beginsaldo (€)</span>
              <input
                type="text" inputMode="decimal" value={balStr}
                aria-label="Beginsaldo betaalrekening in euro"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 14, marginTop: 8 }}
                onChange={(e) => {
                  const v = e.target.value;
                  setBalStr(v);
                  const euros = parseFloat(v.replace(",", "."));
                  update({ startBalanceCents: Number.isFinite(euros) ? Math.round(euros * 100) : 0 });
                }}
              />
            </label>
          </>
        )}
      </div>

      <details className="card card-pad" style={{ marginBottom: 18 }}>
        <summary className="prof-summary card-h">
          <h3>Categorie-koppeling</h3>
          <Ic name="chevronDown" size={16} style={{ marginLeft: "auto", color: "var(--faint)" }} />
        </summary>
        <p style={{ color: "var(--muted)", margin: "12px 0 14px", fontSize: 13.5 }}>
          Geavanceerd: bepaal welke Nibud-post bij elke categorie hoort. Standaard volgt de ingebouwde koppeling;
          kies “Niet vergelijken” om een categorie buiten de vergelijking te houden.
        </p>
        <div className="prof-map">
          {expenseCats.map((c) => {
            const override = p.categoryMapOverrides?.[c.id];
            const value = override === null ? "none" : (override ?? "auto");
            const def = DEFAULT_NIBUD_MAPPING[c.id];
            const opts: DropdownOption[] = [
              { value: "auto", label: def ? `Standaard (${NIBUD_POST_LABELS[def]})` : "Standaard (niet gekoppeld)" },
              { value: "none", label: "Niet vergelijken" },
              ...NIBUD_POST_ORDER.map((post) => ({ value: post, label: NIBUD_POST_LABELS[post], group: "Nibud-post" })),
            ];
            return (
              <div className="prof-map-row" key={c.id}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, flex: "none" }}></span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                </span>
                <Dropdown fullWidth ariaLabel={`Nibud-post voor ${c.name}`} value={value} options={opts}
                  onChange={(v) => {
                    const overrides = { ...(p.categoryMapOverrides ?? {}) };
                    if (v === "auto") delete overrides[c.id];
                    else if (v === "none") overrides[c.id] = null;
                    else overrides[c.id] = v as NibudPostId;
                    update({ categoryMapOverrides: overrides });
                  }} />
              </div>
            );
          })}
        </div>
      </details>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="card-h" style={{ marginBottom: 12 }}><h3>Weergave</h3></div>
        <div className="prof-map-row" style={{ borderBottom: 0 }}>
          <span>Donkere modus</span>
          <button className={"switch" + (theme === "dark" ? " on" : "")} role="switch" aria-checked={theme === "dark"}
            aria-label="Donkere modus aan/uit" onClick={toggle}>
            <span className="switch-knob" />
          </button>
        </div>
      </div>

      <p style={{ color: "var(--faint)", fontSize: 12, lineHeight: 1.5 }}>
        Referentiecijfers: {NIBUD_SOURCE_LABEL} {NIBUD_YEAR} (indicatief).{" "}
        <a href={NIBUD_SOURCE_URL} target="_blank" rel="noopener noreferrer">Bron</a>
      </p>
    </div>
  );
}

/* Centen → vrij bewerkbare invoertekst in euro's ("" bij 0/leeg, zodat het veld leeg oogt). */
function centsToInput(cents: number | undefined): string {
  if (!cents) return "";
  return String(cents / 100);
}

/* Euro-bedrag → NL-geformatteerde weergave voor het read-only beginsaldo-veld. */
function eurInput(euros: number): string {
  return new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(euros);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="prof-field">
      <span className="prof-field-lbl">{label}</span>
      {children}
    </label>
  );
}
