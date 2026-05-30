/* Bedragen worden in de DB als integer-centen opgeslagen om afrondfouten te voorkomen. */

export function toCents(euros: number): number {
  return Math.round(euros * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}
