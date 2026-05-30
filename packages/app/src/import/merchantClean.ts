/* Schoont ruwe ING-banktekst op tot een leesbare merchant-naam.
 * Bijv. "Jumbo De Meern Merel DE MEERN" -> "Jumbo De Meern Merel",
 *       "High And Low Utrecht NLD"      -> "High And Low Utrecht",
 *       "VODAFONE LIBERTEL BV"          -> "Vodafone Libertel BV". */
const PREFIXES = [
  /^BEA,?\s*(NR:\S+\s*)?/i,
  /^BETAALPAS\s*/i,
  /^GEA,?\s*/i,
  /^SEPA\s*(OVERBOEKING|INCASSO|IDEAL)?\s*/i,
  /^IDEAL\s*/i,
  /^\/TRTP\/[^/]*\//i,
];
const NOISE = [
  /\b\d{2}:\d{2}\b/g,          // tijdstempels
  /\bPAS\d+\b/gi,
  /\bNR:\S+/gi,
  /\bIBAN:?\s*\S+/gi,
  /\bBIC:?\s*\S+/gi,
  /\bKENMERK:?.*/gi,
  /\bOMSCHRIJVING:?/gi,
  /\bPASVOLGNR:?\s*\d+/gi,
];

function isAllCaps(tok: string): boolean {
  return /^[A-Z]{2,}$/.test(tok);
}

/* Korte all-caps afkortingen behouden (NS, KPN, AH, BV, BCC); rest title-casen. */
function caseToken(tok: string): string {
  if (/[A-Z]/.test(tok) && /^[A-Z0-9&]{2,4}$/.test(tok)) return tok;
  return tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase();
}

export function cleanMerchant(raw: string): string {
  let s = (raw || "").trim();
  for (const re of PREFIXES) s = s.replace(re, "");
  for (const re of NOISE) s = s.replace(re, " ");
  s = s.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ").replace(/\b\d{2}-\d{2}-\d{4}\b/g, " ");
  s = s.replace(/\s{2,}/g, " ").trim();
  if (!s) return raw.trim() || "Onbekend";

  // Strip een staart van ALL-CAPS tokens (land/stad, bv. "DE MEERN", "UTRECHT NLD"),
  // mits er ook niet-all-caps tokens zijn (anders zou een all-caps merchantnaam wegvallen).
  const toks = s.split(/\s+/);
  if (toks.some((t) => !isAllCaps(t))) {
    while (toks.length > 1 && isAllCaps(toks[toks.length - 1])) toks.pop();
  }
  return toks.map(caseToken).join(" ");
}
