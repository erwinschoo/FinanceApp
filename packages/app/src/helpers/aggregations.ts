import type { Transaction } from "../db/types";

export function txKey(t: Transaction): string {
  return t.date.slice(0, 7);
}
export function txInMonth(txs: Transaction[], key: string): Transaction[] {
  return txs.filter((t) => txKey(t) === key);
}
export function incomeOf(txs: Transaction[]): number {
  return txs.filter((t) => t.category === "inkomen").reduce((s, t) => s + t.amount, 0);
}
/* echte uitgaven: negatief, exclusief sparen */
export function expensesOf(txs: Transaction[]): number {
  return txs.filter((t) => t.amount < 0 && t.category !== "sparen").reduce((s, t) => s + Math.abs(t.amount), 0);
}
export function savingsOf(txs: Transaction[]): number {
  return txs.filter((t) => t.category === "sparen").reduce((s, t) => s + Math.abs(t.amount), 0);
}
/* uitgaven per categorie (id -> euro), excl. sparen/inkomen, alleen negatieven */
export function spendByCat(txs: Transaction[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of txs) {
    if (t.amount < 0 && t.category && t.category !== "sparen") {
      out[t.category] = (out[t.category] || 0) + Math.abs(t.amount);
    }
  }
  return out;
}

/* De laatste 12 maand-keys ('YYYY-MM') eindigend op de huidige maand. */
export function lastTwelveMonthKeys(ref = new Date()): string[] {
  const keys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    let m = ref.getMonth() - i;
    let y = ref.getFullYear();
    while (m < 0) { m += 12; y -= 1; }
    keys.push(`${y}-${String(m + 1).padStart(2, "0")}`);
  }
  return keys;
}
