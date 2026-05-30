import { useApp } from "../state/AppContext";
import type { Transaction } from "../db/types";

export function MerchantAv({ t }: { t: Transaction }) {
  const { catMap } = useApp();
  const c = catMap[t.category] || { color: "var(--muted)", tint: "var(--subtle)" };
  return (
    <span className="mi" style={{ background: c.tint, color: c.color }}>
      {(t.merchant[0] || "?").toUpperCase()}
    </span>
  );
}
