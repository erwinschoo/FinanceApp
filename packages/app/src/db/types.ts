/* Datamodel. In de DB worden bedragen als integer-centen (signed) opgeslagen;
 * in de app-/view-laag werken we met euro's (float) zodat de geporte UI 1-op-1 blijft. */

export type CategoryType = "inkomen" | "uitgave" | "sparen" | "overboeking";

export interface Category {
  id: string;
  name: string;
  color: string;          // CSS var() of hex
  tint: string;           // achtergrondtint
  initial: string;        // letter in merchant-avatar fallback
  type: CategoryType;
  parentId: string | null; // null = hoofdcategorie; anders id van de groep
}

/* ── DB-rijen (centen) ── */
export interface TxRow {
  id: string;
  date: string;             // ISO 'YYYY-MM-DD'
  merchant: string;         // opgeschoonde naam
  rawDescription: string;   // ruwe banktekst
  category: string;         // category id, "" = niet ingedeeld
  amountCents: number;      // signed; >0 = bij, <0 = af
  auto: boolean;            // automatisch ingedeeld?
  note: string;
  counterIban: string;      // tegenrekening (voor dedupe)
  accountIban: string;      // eigen rekening
  importBatchId: string;
  dedupeHash: string;       // uniek; voorkomt dubbele import
  balanceCents?: number;    // saldo na deze transactie (uit ING 'Resulting balance')
}

export interface BudgetRow {
  id: string;               // = `${categoryId}:${month ?? 'recurring'}`
  categoryId: string;
  month: string | null;     // 'YYYY-MM' of null (= geldt elke maand)
  amountCents: number;
  carryOver: boolean;
}

export interface RuleRow {
  id: string;
  field: "merchant" | "rawDescription";
  pattern: string;
  matchType: "contains" | "regex";
  categoryId: string;
  priority: number;
}

export interface GoalRow {
  id: string;
  name: string;
  targetCents: number;
  currentCents: number;
  monthlyCents: number;
  startDate: string;        // ISO
  targetDate: string;       // ISO
  priority: number;         // lager = hoger
  color: string;
}

export interface ImportBatchRow {
  id: string;
  filename: string;
  importedAt: string;       // ISO datetime
  count: number;
}

export interface ImportProfileRow {
  id: string;
  bankName: string;
  columnMap: Record<string, string>;
  dateFormat: string;
  decimalSep: string;
}

export interface MetaRow {
  key: string;              // 'sync' etc.
  value: unknown;
}

/* Tegenpartij = een vaste payee. Geïdentificeerd via IBAN indien aanwezig,
 * anders via de opgeschoonde merchant-naam (pinbetalingen hebben geen IBAN). */
export interface PayeeRow {
  key: string;              // PK: "iban:<iban>" of "merchant:<naam>"
  kind: "iban" | "merchant";
  iban: string;             // "" bij merchant-kind
  name: string;             // weergavenaam
  categoryId: string;       // toegewezen categorie ("" = nog niet)
}

/* ── App-/view-model (euro's) ── */
export interface Transaction {
  id: string;
  date: string;
  merchant: string;
  rawDescription: string;
  category: string;
  amount: number;           // euro's (float)
  auto: boolean;
  note: string;
  counterIban: string;
  accountIban: string;
  importBatchId: string;
  dedupeHash: string;
  balance?: number;          // saldo na deze transactie (euro's)
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  monthly: number;
  startDate: string;
  targetDate: string;
  priority: number;
  color: string;
}

/* een geparste, nog niet opgeslagen rij uit een bankexport */
export interface ParsedRow {
  date: string;             // ISO
  rawDescription: string;
  merchant: string;
  amount: number;           // euro's
  counterIban: string;
  accountIban: string;
  category: string;         // door regels herkend, "" indien onbekend
  dedupeHash: string;
  duplicate: boolean;       // bestaat al in de DB?
  balance: number | null;   // saldo na transactie (uit ING), null indien onbekend
}
