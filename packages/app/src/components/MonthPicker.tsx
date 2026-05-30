import { useApp } from "../state/AppContext";
import { monthKeyLabelFull } from "../lib/format";
import { Ic } from "./Ic";

export function MonthPicker() {
  const { months, monthIdx, setMonthIdx } = useApp();
  return (
    <div className="month-pick">
      <button onClick={() => setMonthIdx(Math.max(0, monthIdx - 1))} disabled={monthIdx === 0} aria-label="Vorige maand">
        <Ic name="chevronLeft" size={18} />
      </button>
      <span className="lbl tnum">{monthKeyLabelFull(months[monthIdx])}</span>
      <button onClick={() => setMonthIdx(Math.min(months.length - 1, monthIdx + 1))} disabled={monthIdx === months.length - 1} aria-label="Volgende maand">
        <Ic name="chevronRight" size={18} />
      </button>
    </div>
  );
}
