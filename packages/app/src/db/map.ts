import { fromCents } from "../lib/money";
import type { TxRow, Transaction, GoalRow, Goal } from "./types";

export function rowToTx(r: TxRow): Transaction {
  return { ...r, amount: fromCents(r.amountCents), balance: r.balanceCents != null ? fromCents(r.balanceCents) : undefined };
}

export function rowToGoal(r: GoalRow): Goal {
  return {
    id: r.id,
    name: r.name,
    target: fromCents(r.targetCents),
    current: fromCents(r.currentCents),
    monthly: fromCents(r.monthlyCents),
    startDate: r.startDate,
    targetDate: r.targetDate,
    priority: r.priority,
    color: r.color,
  };
}
