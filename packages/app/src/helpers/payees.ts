import type { Transaction } from "../db/types";

export interface PayeeRef {
  counterIban: string;
  merchant: string;
}

/* Identiteit van een tegenpartij: IBAN indien aanwezig, anders de merchant-naam. */
export function payeeKey(t: PayeeRef): string {
  return t.counterIban ? "iban:" + t.counterIban : "merchant:" + t.merchant;
}

export function payeeKind(t: PayeeRef): "iban" | "merchant" {
  return t.counterIban ? "iban" : "merchant";
}

export interface PayeeOverview {
  key: string;
  kind: "iban" | "merchant";
  iban: string;
  name: string;
  count: number;
  total: number;       // som van bedragen (signed)
  lastDate: string;    // ISO
  categoryId: string;  // toegewezen ("" = niet ingedeeld)
}

/* Bouw het tegenpartij-overzicht uit alle transacties, verrijkt met de mapping. */
export function buildPayeeOverview(
  transactions: Transaction[],
  payeeMap: Map<string, string>,
): PayeeOverview[] {
  const byKey = new Map<string, PayeeOverview>();
  for (const t of transactions) {
    const key = payeeKey(t);
    let p = byKey.get(key);
    if (!p) {
      p = {
        key,
        kind: payeeKind(t),
        iban: t.counterIban,
        name: t.merchant || (t.counterIban ? t.counterIban : "Onbekend"),
        count: 0,
        total: 0,
        lastDate: t.date,
        categoryId: payeeMap.get(key) ?? "",
      };
      byKey.set(key, p);
    }
    p.count += 1;
    p.total += t.amount;
    if (t.date > p.lastDate) {
      p.lastDate = t.date;
      if (t.merchant) p.name = t.merchant; // nieuwste naam
    }
  }
  return [...byKey.values()];
}
