/* Euro-formattering (werkt op euro's, identiek aan het prototype). */

export const eur = (n: number, dec = 0): string =>
  "€ " +
  Number(Math.abs(n)).toLocaleString("nl-NL", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

export const eurSign = (n: number, dec = 0): string => (n < 0 ? "−" : "") + eur(n, dec);

export const MONTHS_NL = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];
export const MONTHS_SH = [
  "jan", "feb", "mrt", "apr", "mei", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
];

/* '2026-05' -> 'mei 2026' */
export function monthKeyLabelFull(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_NL[m - 1]} ${y}`;
}
/* '2026-05' -> "mei '26" */
export function monthKeyLabelShort(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_SH[m - 1]} '${String(y).slice(2)}`;
}
/* ISO date -> '22 mei' */
export function fmtDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_SH[m - 1]}`;
}
