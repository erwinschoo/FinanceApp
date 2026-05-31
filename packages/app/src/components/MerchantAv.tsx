import { useApp } from "../state/AppContext";
import { catTint } from "../lib/catColor";
import type { Transaction } from "../db/types";

export function MerchantAv({ t }: { t: Transaction }) {
  const { catMap } = useApp();
  const c = catMap[t.category] || { color: "var(--muted)" };
  return (
    <span className="mi" style={{ background: catTint(c.color), color: c.color }}>
      {(t.merchant[0] || "?").toUpperCase()}
    </span>
  );
}
