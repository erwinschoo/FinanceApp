import type { RuleRow } from "../db/types";
import { uid } from "../lib/id";

/* Pas regels toe op een transactie-achtig object. Retourneert de category id of "".
 * Regels worden op prioriteit (laag eerst) gesorteerd; eerste match wint. */
export function matchCategory(
  fields: { merchant: string; rawDescription: string },
  rules: RuleRow[],
): string {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  for (const r of sorted) {
    const hay = (r.field === "merchant" ? fields.merchant : fields.rawDescription) || "";
    if (testRule(hay, r)) return r.categoryId;
  }
  return "";
}

function testRule(haystack: string, r: RuleRow): boolean {
  if (r.matchType === "regex") {
    try {
      return new RegExp(r.pattern, "i").test(haystack);
    } catch {
      return false;
    }
  }
  return haystack.toUpperCase().includes(r.pattern.toUpperCase());
}

/* Maak een nieuwe "bevat"-regel op basis van een handmatige indeling. */
export function makeRule(
  field: "merchant" | "rawDescription",
  pattern: string,
  categoryId: string,
  priority = 100,
): RuleRow {
  return { id: uid("r"), field, pattern, matchType: "contains", categoryId, priority };
}

/* Standaardregels — herkennen veel voorkomende NL-merchants in ING-omschrijvingen.
 * 'contains' is hoofdletter-ongevoelig. Lagere priority = eerder geëvalueerd. */
export const DEFAULT_RULES: Omit<RuleRow, "id">[] = [
  // inkomen / sparen (specifiek → lage priority)
  { field: "rawDescription", pattern: "SALARIS", matchType: "contains", categoryId: "inkomen", priority: 10 },
  { field: "rawDescription", pattern: "SPAARREKENING", matchType: "contains", categoryId: "sparen", priority: 10 },
  // aflossingen / studieschuld
  { field: "rawDescription", pattern: "DUO", matchType: "contains", categoryId: "aflossingen", priority: 15 },
  { field: "rawDescription", pattern: "STUDIEFINANCIERING", matchType: "contains", categoryId: "aflossingen", priority: 15 },
  // wonen
  { field: "rawDescription", pattern: "HUUR", matchType: "contains", categoryId: "wonen", priority: 20 },
  { field: "rawDescription", pattern: "VESTEDA", matchType: "contains", categoryId: "wonen", priority: 20 },
  { field: "rawDescription", pattern: "ENECO", matchType: "contains", categoryId: "wonen", priority: 20 },
  { field: "rawDescription", pattern: "VITENS", matchType: "contains", categoryId: "wonen", priority: 20 },
  { field: "rawDescription", pattern: "GEMEENTE", matchType: "contains", categoryId: "wonen", priority: 25 },
  // boodschappen
  { field: "rawDescription", pattern: "ALBERT HEIJN", matchType: "contains", categoryId: "boodschappen", priority: 30 },
  { field: "rawDescription", pattern: "AH ", matchType: "contains", categoryId: "boodschappen", priority: 35 },
  { field: "rawDescription", pattern: "JUMBO", matchType: "contains", categoryId: "boodschappen", priority: 30 },
  { field: "rawDescription", pattern: "LIDL", matchType: "contains", categoryId: "boodschappen", priority: 30 },
  { field: "rawDescription", pattern: "DIRK", matchType: "contains", categoryId: "boodschappen", priority: 30 },
  { field: "rawDescription", pattern: "MARQT", matchType: "contains", categoryId: "boodschappen", priority: 30 },
  { field: "rawDescription", pattern: "BAKKER", matchType: "contains", categoryId: "boodschappen", priority: 35 },
  // vervoer
  { field: "rawDescription", pattern: "SHELL", matchType: "contains", categoryId: "vervoer", priority: 30 },
  { field: "rawDescription", pattern: "NS GROEP", matchType: "contains", categoryId: "vervoer", priority: 30 },
  { field: "rawDescription", pattern: "NS REIZEN", matchType: "contains", categoryId: "vervoer", priority: 30 },
  { field: "rawDescription", pattern: "Q-PARK", matchType: "contains", categoryId: "vervoer", priority: 30 },
  { field: "rawDescription", pattern: "OV-CHIP", matchType: "contains", categoryId: "vervoer", priority: 30 },
  { field: "rawDescription", pattern: "SWAPFIETS", matchType: "contains", categoryId: "vervoer", priority: 30 },
  // abonnementen
  { field: "rawDescription", pattern: "NETFLIX", matchType: "contains", categoryId: "abonnementen", priority: 30 },
  { field: "rawDescription", pattern: "SPOTIFY", matchType: "contains", categoryId: "abonnementen", priority: 30 },
  { field: "rawDescription", pattern: "KPN", matchType: "contains", categoryId: "abonnementen", priority: 30 },
  { field: "rawDescription", pattern: "ICLOUD", matchType: "contains", categoryId: "abonnementen", priority: 30 },
  { field: "rawDescription", pattern: "PAROOL", matchType: "contains", categoryId: "abonnementen", priority: 30 },
  { field: "rawDescription", pattern: "FITFORFREE", matchType: "contains", categoryId: "abonnementen", priority: 30 },
  // gezondheid
  { field: "rawDescription", pattern: "ETOS", matchType: "contains", categoryId: "gezondheid", priority: 30 },
  { field: "rawDescription", pattern: "APOTHEEK", matchType: "contains", categoryId: "gezondheid", priority: 30 },
  { field: "rawDescription", pattern: "TANDARTS", matchType: "contains", categoryId: "gezondheid", priority: 30 },
  { field: "rawDescription", pattern: "FYSIO", matchType: "contains", categoryId: "gezondheid", priority: 30 },
  // vrije tijd
  { field: "rawDescription", pattern: "RESTAURANT", matchType: "contains", categoryId: "vrijetijd", priority: 40 },
  { field: "rawDescription", pattern: "TOSCANA", matchType: "contains", categoryId: "vrijetijd", priority: 40 },
  { field: "rawDescription", pattern: "CAFE", matchType: "contains", categoryId: "vrijetijd", priority: 40 },
  { field: "rawDescription", pattern: "PATHE", matchType: "contains", categoryId: "vrijetijd", priority: 40 },
  { field: "rawDescription", pattern: "BOL.COM", matchType: "contains", categoryId: "vrijetijd", priority: 40 },
  { field: "rawDescription", pattern: "COOLBLUE", matchType: "contains", categoryId: "vrijetijd", priority: 40 },
  { field: "rawDescription", pattern: "DECATHLON", matchType: "contains", categoryId: "vrijetijd", priority: 40 },
  // verzekeringen
  { field: "rawDescription", pattern: "ZILVEREN KRUIS", matchType: "contains", categoryId: "verzekeringen", priority: 30 },
  { field: "rawDescription", pattern: "CENTRAAL BEHEER", matchType: "contains", categoryId: "verzekeringen", priority: 30 },
  { field: "rawDescription", pattern: "INTERPOLIS", matchType: "contains", categoryId: "verzekeringen", priority: 30 },
];
