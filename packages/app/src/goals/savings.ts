import type { Category, Goal, Transaction } from "../db/types";
import type { Pot } from "../db/map";

export interface SavingsRow { goal: Goal; filled: number; pct: number; done: boolean }

export interface SavingsGroup {
  categoryId: string;
  name: string;
  color: string;
  tint: string;
  initial: string;
  opening: number;     // startsaldo / nul lijn
  monthly: number;     // maandelijkse inleg
  inverted: boolean;
  balance: number;     // potwaarde = opening ± som van transacties
  totalTarget: number; // som van alle doelbedragen in de categorie
  rows: SavingsRow[];  // doelen op prioriteit met waterfall-vulling
  activeIdx: number;   // index van het eerste niet-voltooide doel
  allDone: boolean;
}

export interface Savings {
  groups: SavingsGroup[];
  library: Category[];               // categorieën die nog geen spaarpot zijn
  filledById: Map<string, number>;   // doel-id → toegekend bedrag (voor o.a. dashboard)
}

/* Verdeel de potwaarde over de doelen op prioriteit (waterfall): #1 eerst vol,
 * overschot stroomt door naar #2, enz. */
function allocateGroup(goals: Goal[], balance: number) {
  let rem = balance;
  const rows: SavingsRow[] = [...goals]
    .sort((a, b) => a.priority - b.priority)
    .map((goal) => {
      const filled = Math.max(0, Math.min(rem, goal.target));
      rem -= filled;
      return { goal, filled, done: goal.target > 0 && filled >= goal.target - 0.005, pct: goal.target ? filled / goal.target : 0 };
    });
  const firstOpen = rows.findIndex((r) => !r.done);
  return { rows, activeIdx: firstOpen === -1 ? Math.max(0, rows.length - 1) : firstOpen, allDone: rows.length > 0 && firstOpen === -1 };
}

/* Bouw de spaarcategorieën (groups) en de nog toe te voegen bibliotheek.
 * Een categorie is een "spaarcategorie" zodra hij een pot heeft óf ≥1 doel. */
export function buildSavings(
  categories: Category[],
  goals: Goal[],
  transactions: Transaction[],
  pots: Pot[],
): Savings {
  const potByCat = new Map(pots.map((p) => [p.categoryId, p]));

  const sumByCat = new Map<string, number>();
  for (const t of transactions) {
    if (!t.category) continue;
    sumByCat.set(t.category, (sumByCat.get(t.category) ?? 0) + t.amount);
  }

  const goalsByCat = new Map<string, Goal[]>();
  for (const g of goals) {
    if (!g.categoryId) continue;
    const arr = goalsByCat.get(g.categoryId) ?? [];
    arr.push(g);
    goalsByCat.set(g.categoryId, arr);
  }

  const isGroup = (id: string) => potByCat.has(id) || goalsByCat.has(id);

  const filledById = new Map<string, number>();
  const groups: SavingsGroup[] = [];
  for (const c of categories) {
    if (!isGroup(c.id)) continue;
    const pot = potByCat.get(c.id);
    const opening = pot?.opening ?? 0;
    const inverted = pot?.inverted ?? false;
    const monthly = pot?.monthly ?? 0;
    const flow = sumByCat.get(c.id) ?? 0;
    const balance = opening + (inverted ? -flow : flow);
    const gs = goalsByCat.get(c.id) ?? [];
    const { rows, activeIdx, allDone } = allocateGroup(gs, balance);
    for (const r of rows) filledById.set(r.goal.id, r.filled);
    groups.push({
      categoryId: c.id, name: c.name, color: c.color, tint: c.tint, initial: c.initial,
      opening, monthly, inverted, balance,
      totalTarget: gs.reduce((s, g) => s + g.target, 0),
      rows, activeIdx, allDone,
    });
  }

  const library = categories.filter((c) => !isGroup(c.id));
  return { groups, library, filledById };
}
