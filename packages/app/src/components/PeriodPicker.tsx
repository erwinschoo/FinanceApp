import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../state/AppContext";
import { MONTHS_NL } from "../lib/format";
import { Dropdown } from "./Dropdown";
import { Ic } from "./Ic";

/* Periode-kiezer in de topbar: een datum-icoonknop die een popover opent met een jaar-dropdown
 * en een maand-dropdown. De maand-dropdown heeft bovenaan "Heel [jaar]" (= heel jaar), met een
 * divider los van de maandenlijst. Schaalt mee bij meerdere jaren historie. */
export function PeriodPicker() {
  const { periodYear, periodMonth, setPeriodYear, setPeriodMonth, periodLabel, dataYears, dataMonthKeys } = useApp();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t) || panelRef.current?.contains(t)) return;
      // De jaar/maand-keuzelijsten zweven (portal naar body), dus buiten panelRef.
      // Een klik dáárin mag de popover niet sluiten — anders verdwijnt de lijst vóór
      // de optie-klik afgaat en wordt de keuze niet toegepast.
      const el = t instanceof Element ? t : (t as ChildNode).parentElement;
      if (el?.closest(".cat-menu")) return;
      setOpen(false);
    }
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // Jaren uit de data (aflopend); zorg dat het actieve jaar er altijd bij staat.
  const yearOptions = useMemo(() => {
    const set = new Set<number>(dataYears);
    set.add(periodYear);
    return Array.from(set).sort((a, b) => b - a).map((y) => ({ value: String(y), label: String(y) }));
  }, [dataYears, periodYear]);

  // Maand-opties voor het gekozen jaar: "Heel [jaar]" + de data-maanden in kalendervolgorde.
  const monthOptions = useMemo(() => {
    const prefix = `${periodYear}-`;
    const monthsOfYear = dataMonthKeys.filter((k) => k.startsWith(prefix)).sort();
    return [
      { value: "all", label: `Heel ${periodYear}` },
      ...monthsOfYear.map((k, i) => ({
        value: k,
        label: MONTHS_NL[Number(k.slice(5, 7)) - 1],
        divider: i === 0, // scheidt "Heel [jaar]" van de maandenlijst
      })),
    ];
  }, [dataMonthKeys, periodYear]);

  const monthValue = periodMonth === "all" ? "all" : `${periodYear}-${String(periodMonth).padStart(2, "0")}`;

  function toggle() {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      // Op mobile staat de knop onderaan vast → popover opwaarts openen zodat hij zichtbaar blijft.
      const right = Math.max(8, window.innerWidth - r.right);
      setPos(r.bottom > window.innerHeight * 0.6
        ? { bottom: window.innerHeight - r.top + 6, right }
        : { top: r.bottom + 6, right });
    }
    setOpen((o) => !o);
  }

  function onYear(v: string) {
    const y = Number(v);
    setPeriodYear(y);
    // Heeft het nieuwe jaar geen data voor de huidige maand → val terug op "Heel jaar".
    if (periodMonth !== "all" && !dataMonthKeys.includes(`${y}-${String(periodMonth).padStart(2, "0")}`)) {
      setPeriodMonth("all");
    }
  }
  function onMonth(v: string) {
    setPeriodMonth(v === "all" ? "all" : Number(v.slice(5, 7)));
  }

  return (
    <div className="cat-select period-picker" ref={ref}>
      <button type="button" className="dd-trigger" aria-label="Kies periode" onClick={toggle}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Ic name="calendar" size={16} />
          <span className="dd-lbl" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{periodLabel}</span>
        </span>
        <Ic name="chevronDown" size={15} />
      </button>

      {open && createPortal(
        <div ref={panelRef} className="period-pop" style={{ position: "fixed", top: pos?.top ?? "auto", bottom: pos?.bottom ?? "auto", right: pos?.right }}>
          <label className="period-field">
            <span className="period-lbl">Jaar</span>
            <Dropdown value={String(periodYear)} onChange={onYear} options={yearOptions} ariaLabel="Kies jaar" fullWidth floating />
          </label>
          <label className="period-field">
            <span className="period-lbl">Maand</span>
            <Dropdown value={monthValue} onChange={onMonth} options={monthOptions} ariaLabel="Kies maand" fullWidth floating />
          </label>
        </div>,
        document.body,
      )}
    </div>
  );
}
