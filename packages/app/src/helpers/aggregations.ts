import type { Transaction, Category } from "../db/types";

type CatMap = Record<string, Category>;

export function txKey(t: Transaction): string {
  return t.date.slice(0, 7);
}
export function txInMonth(txs: Transaction[], key: string): Transaction[] {
  return txs.filter((t) => txKey(t) === key);
}

function typeOf(catId: string, catMap: CatMap): Category["type"] | undefined {
  return catMap[catId]?.type;
}

export function incomeOf(txs: Transaction[], catMap: CatMap): number {
  return txs.filter((t) => typeOf(t.category, catMap) === "inkomen").reduce((s, t) => s + t.amount, 0);
}
/* echte uitgaven: negatief én niet inkomen/sparen/overboeking (ongecategoriseerd telt mee) */
export function expensesOf(txs: Transaction[], catMap: CatMap): number {
  return txs
    .filter((t) => {
      if (t.amount >= 0) return false;
      const ty = typeOf(t.category, catMap);
      return ty !== "inkomen" && ty !== "sparen" && ty !== "overboeking";
    })
    .reduce((s, t) => s + Math.abs(t.amount), 0);
}
export function savingsOf(txs: Transaction[], catMap: CatMap): number {
  return txs.filter((t) => typeOf(t.category, catMap) === "sparen").reduce((s, t) => s + Math.abs(t.amount), 0);
}
/* uitgaven per categorie-id (alleen ingedeelde uitgaven, negatief) */
export function spendByCat(txs: Transaction[], catMap: CatMap): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of txs) {
    if (t.amount < 0 && t.category && typeOf(t.category, catMap) === "uitgave") {
      out[t.category] = (out[t.category] || 0) + Math.abs(t.amount);
    }
  }
  return out;
}

/* Het hoofd(groep)-id van een categorie: parent indien aanwezig, anders zichzelf. */
export function topLevelOf(catId: string, catMap: CatMap): string {
  const c = catMap[catId];
  if (!c) return catId;
  return c.parentId ?? c.id;
}
/* Rol een per-categorie-bedrag op naar hoofdgroep-niveau. */
export function rollupToTopLevel(spend: Record<string, number>, catMap: CatMap): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [catId, v] of Object.entries(spend)) {
    const top = topLevelOf(catId, catMap);
    out[top] = (out[top] || 0) + v;
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
