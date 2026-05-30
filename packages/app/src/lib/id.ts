/* Stabiele, korte id's en een deterministische dedupe-hash. */

export function uid(prefix = ""): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/* Deterministische hash (djb2-variant) over de identificerende velden van een transactie.
 * Voorkomt dubbele import bij overlappende bankexports. */
export function dedupeHash(parts: (string | number)[]): string {
  const s = parts.join("|");
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}
