import { MONTHS_NL, MONTHS_SH } from "../lib/format";
import type { Goal } from "../db/types";

export interface GoalCalc {
  remaining: number;
  pct: number;
  monthsNeeded: number;        // Infinity als monthly <= 0
  endLabel: string;
  projection: { labels: string[]; growth: number[]; target: number[] };
}

export function calcGoal(goal: Goal, ref = new Date()): GoalCalc {
  const remaining = Math.max(0, goal.target - goal.current);
  const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
  const monthsNeeded = goal.monthly > 0 ? Math.ceil(remaining / goal.monthly) : Infinity;

  const endLabel = (() => {
    if (!isFinite(monthsNeeded)) return "—";
    let m = ref.getMonth() + monthsNeeded;
    let y = ref.getFullYear();
    y += Math.floor(m / 12);
    m = m % 12;
    return `${MONTHS_NL[m]} ${y}`;
  })();

  const projection = (() => {
    const labels: string[] = [];
    const growth: number[] = [];
    const target: number[] = [];
    let bal = goal.current;
    const cap = Math.min(30, isFinite(monthsNeeded) ? monthsNeeded + 2 : 18);
    for (let i = 0; i <= cap; i++) {
      let m = ref.getMonth() + i;
      let y = ref.getFullYear();
      y += Math.floor(m / 12);
      m = m % 12;
      labels.push(i % 3 === 0 ? `${MONTHS_SH[m]} '${String(y).slice(2)}` : "");
      growth.push(Math.min(bal, goal.target * 1.02));
      target.push(goal.target);
      bal += goal.monthly;
    }
    return { labels, growth, target };
  })();

  return { remaining, pct, monthsNeeded, endLabel, projection };
}
