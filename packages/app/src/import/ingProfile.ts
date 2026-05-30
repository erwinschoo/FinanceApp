import { cleanMerchant } from "./merchantClean";

/* Ruwe rij = object met header → waarde (uit SheetJS). */
export type RawRecord = Record<string, string | number>;

export interface MappedRow {
  date: string;          // ISO
  rawDescription: string;
  merchant: string;
  amount: number;        // euro's, signed
  counterIban: string;
  accountIban: string;
  balance: number | null; // saldo na transactie (euro's), null indien niet aanwezig
}

/* Mogelijke kolomnamen per veld — ING varieert soms licht. */
const COLS = {
  date: ["Datum", "Date"],
  name: ["Naam / Omschrijving", "Naam", "Name / Description"],
  account: ["Rekening", "Account"],
  counter: ["Tegenrekening", "Counterparty"],
  debitCredit: ["Af Bij", "Af/Bij", "Debit/credit"],
  amount: ["Bedrag (EUR)", "Bedrag", "Amount (EUR)", "Amount"],
  memo: ["Mededelingen", "Mededeling", "Notifications"],
  balance: ["Resulting balance", "Saldo na mutatie", "Resulting Balance", "Saldo"],
};

function get(rec: RawRecord, names: string[]): string {
  for (const n of names) {
    if (rec[n] != null && rec[n] !== "") return String(rec[n]);
  }
  // case-insensitieve fallback
  const lower = Object.fromEntries(Object.entries(rec).map(([k, v]) => [k.toLowerCase(), v]));
  for (const n of names) {
    const v = lower[n.toLowerCase()];
    if (v != null && v !== "") return String(v);
  }
  return "";
}

/* 'YYYYMMDD' of 'YYYY-MM-DD' of 'DD-MM-YYYY' → ISO 'YYYY-MM-DD'. */
function parseDate(raw: string): string {
  const s = raw.trim();
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return s;
}

/* '1.234,56' of '1234,56' of '1234.56' → number. */
function parseAmount(raw: string): number {
  let s = raw.trim().replace(/\s/g, "");
  if (s.includes(",")) {
    // NL-notatie: punt = duizendtal, komma = decimaal
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

export function mapIngRow(rec: RawRecord): MappedRow {
  const rawDate = get(rec, COLS.date);
  const name = get(rec, COLS.name);
  const memo = get(rec, COLS.memo);
  const af = get(rec, COLS.debitCredit).toLowerCase();
  let amount = Math.abs(parseAmount(get(rec, COLS.amount)));
  if (af.startsWith("af") || af.startsWith("d")) amount = -amount;
  const rawDescription = [name, memo].filter(Boolean).join(" — ").trim() || name;
  const rawBalance = get(rec, COLS.balance);
  const balance = rawBalance ? parseAmount(rawBalance) : null;
  return {
    date: parseDate(rawDate),
    rawDescription,
    merchant: cleanMerchant(name || memo),
    amount,
    counterIban: get(rec, COLS.counter),
    accountIban: get(rec, COLS.account),
    balance,
  };
}
