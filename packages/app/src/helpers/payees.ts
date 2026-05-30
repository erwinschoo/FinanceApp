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
  const catCounts = new Map<string, Map<string, number>>(); // key -> (categoryId -> count)
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
        categoryId: "",
      };
      byKey.set(key, p);
      catCounts.set(key, new Map());
    }
    p.count += 1;
    p.total += t.amount;
    if (t.date > p.lastDate) {
      p.lastDate = t.date;
      if (t.merchant) p.name = t.merchant; // nieuwste naam
    }
    if (t.category) {
      const cc = catCounts.get(key)!;
      cc.set(t.category, (cc.get(t.category) ?? 0) + 1);
    }
  }
  // categorie = opgeslagen mapping, anders de meest voorkomende categorie van de transacties
  for (const [key, p] of byKey) {
    const mapped = payeeMap.get(key);
    if (mapped) { p.categoryId = mapped; continue; }
    let best = "", bestN = 0;
    for (const [cat, n] of catCounts.get(key)!) {
      if (n > bestN) { best = cat; bestN = n; }
    }
    p.categoryId = best;
  }
  return [...byKey.values()];
}
