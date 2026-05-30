import * as XLSX from "xlsx";
import { mapIngRow, type RawRecord } from "./ingProfile";
import { matchCategory } from "../categorize/rules";
import { dedupeHash } from "../lib/id";
import { toCents } from "../lib/money";
import { existingHashes, existingPayeeMap } from "../db/repo";
import { payeeKey } from "../helpers/payees";
import type { ParsedRow, RuleRow } from "../db/types";

/* Lees een Excel-/CSV-bestand in tot rij-objecten (header → waarde). */
async function readWorkbook(file: File): Promise<RawRecord[]> {
  const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
  const wb = isCsv
    ? XLSX.read(await file.text(), { type: "string", raw: true })
    : XLSX.read(await file.arrayBuffer(), { type: "array", raw: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<RawRecord>(sheet, { defval: "", raw: false });
}

/* Parse een bankexport tot ParsedRow[] (categorie via regels, duplicaten gemarkeerd). */
export async function parseFile(file: File, rules: RuleRow[]): Promise<ParsedRow[]> {
  const records = await readWorkbook(file);
  const hashes = await existingHashes();
  const payeeMap = await existingPayeeMap();
  const seenInFile = new Set<string>();

  const rows: ParsedRow[] = [];
  for (const rec of records) {
    const m = mapIngRow(rec);
    if (!m.date || !m.rawDescription) continue;
    const cents = toCents(m.amount);
    const hash = dedupeHash([m.date, cents, m.counterIban, m.rawDescription]);
    // Tegenpartij-toewijzing wint van brede trefwoordregels.
    const category =
      payeeMap.get(payeeKey({ counterIban: m.counterIban, merchant: m.merchant })) ??
      matchCategory({ merchant: m.merchant, rawDescription: m.rawDescription }, rules);
    const duplicate = hashes.has(hash) || seenInFile.has(hash);
    seenInFile.add(hash);
    rows.push({
      date: m.date,
      rawDescription: m.rawDescription,
      merchant: m.merchant,
      amount: m.amount,
      counterIban: m.counterIban,
      accountIban: m.accountIban,
      category,
      dedupeHash: hash,
      duplicate,
      balance: m.balance,
    });
  }
  // nieuwste eerst
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return rows;
}
