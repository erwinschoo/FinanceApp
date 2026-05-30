import { useMemo } from "react";
import { useApp } from "../state/AppContext";
import { monthKeyLabelFull } from "../lib/format";
import { txKey } from "../helpers/aggregations";
import { Dropdown } from "./Dropdown";

export function MonthPicker() {
  const { months, monthIdx, setMonthIdx, transactions } = useApp();

  // Maanden mét data binnen het 12-maands-venster (nieuwste eerst); val terug op alle maanden.
  const options = useMemo(() => {
    const dataKeys = new Set(transactions.map((t) => txKey(t)));
    const withData = months.filter((mk) => dataKeys.has(mk));
    const list = (withData.length ? withData : months).slice().reverse();
    return list.map((mk) => ({ value: mk, label: monthKeyLabelFull(mk) }));
  }, [months, transactions]);

  return (
    <Dropdown
      value={months[monthIdx]}
      onChange={(mk) => { const i = months.indexOf(mk); if (i >= 0) setMonthIdx(i); }}
      options={options}
      ariaLabel="Kies maand"
      minWidth={170}
    />
  );
}
