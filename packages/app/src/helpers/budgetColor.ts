/* Budgetkleur-schaal (ratio uitgegeven/budget → vulkleur)
 *  0–70%  : licht groen  → donker groen
 *  70–85% : licht oranje → donker oranje
 *  85–100%: licht rood   → donker rood
 *  ≥100%  : blijft donker rood */
type RGB = [number, number, number];
const BUD_STOPS: Record<string, RGB> = {
  greenLo: [127, 185, 142], greenHi: [46, 125, 79],
  orangeLo: [233, 169, 113], orangeHi: [217, 119, 46],
  redLo: [222, 138, 130], redHi: [178, 59, 46],
};
function lerp(a: RGB, b: RGB, t: number): string {
  t = Math.max(0, Math.min(1, t));
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
export function budgetColor(r: number): string {
  if (r <= 0.7) return lerp(BUD_STOPS.greenLo, BUD_STOPS.greenHi, r / 0.7);
  if (r <= 0.85) return lerp(BUD_STOPS.orangeLo, BUD_STOPS.orangeHi, (r - 0.7) / 0.15);
  if (r < 1.0) return lerp(BUD_STOPS.redLo, BUD_STOPS.redHi, (r - 0.85) / 0.15);
  return lerp(BUD_STOPS.redLo, BUD_STOPS.redHi, 1);
}
