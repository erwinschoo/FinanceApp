import type { Goal, Transaction } from "../db/types";
import type { Pot } from "../db/map";

export interface GoalAllocation {
  current: number;     // aan dit doel toegekend (euro)
  potTotal: number;    // totale potwaarde van de gekoppelde categorie
  position: number;    // 1-based positie binnen de categorie (vulvolgorde)
  countInCat: number;  // aantal doelen op dezelfde categorie
  buffer: number;      // ongealloceerd restant in de pot (na alle doelen)
}

/* Verdeel per categorie de pot (startsaldo + som van transacties) over de doelen
 * op prioriteitsvolgorde (waterfall): doel #1 eerst vol, restant naar #2, enz. */
export function allocateGoals(
  goals: Goal[],
  transactions: Transaction[],
  pots: Pot[],
): Map<string, GoalAllocation> {
  const potByCat = new Map(pots.map((p) => [p.categoryId, p]));

  // som van transactiebedragen per categorie
  const sumByCat = new Map<string, number>();
  for (const t of transactions) {
    if (!t.category) continue;
    sumByCat.set(t.category, (sumByCat.get(t.category) ?? 0) + t.amount);
  }

  // doelen groeperen per gekoppelde categorie
  const byCat = new Map<string, Goal[]>();
  for (const g of goals) {
    if (!g.categoryId) continue;
    const arr = byCat.get(g.categoryId) ?? [];
    arr.push(g);
    byCat.set(g.categoryId, arr);
  }

  const out = new Map<string, GoalAllocation>();
  for (const [catId, gs] of byCat) {
    const pot = potByCat.get(catId);
    const opening = pot?.opening ?? 0;
    const flow = sumByCat.get(catId) ?? 0;
    const potTotal = opening + (pot?.inverted ? -flow : flow);

    const ordered = [...gs].sort((a, b) => a.priority - b.priority);
    let running = Math.max(0, potTotal);
    ordered.forEach((g, i) => {
      const allocated = Math.max(0, Math.min(running, g.target));
      running -= allocated;
      out.set(g.id, { current: allocated, potTotal, position: i + 1, countInCat: ordered.length, buffer: 0 });
    });
    // buffer = restant na alle doelen; achteraf invullen voor elk doel in de categorie
    for (const g of ordered) {
      const a = out.get(g.id)!;
      a.buffer = running;
    }
  }

  return out;
}
