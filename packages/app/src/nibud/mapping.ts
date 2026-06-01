import type { HouseholdProfile, NibudPostId } from "../db/types";

/* Standaardkoppeling bokkiep-categorie-id → Nibud-uitgavenpost.
 * Alleen de standaardcategorieën uit categories.ts hebben een vaste mapping;
 * eigen/onbekende categorieën zijn standaard niet gekoppeld (en worden dus niet
 * vergeleken) tenzij de gebruiker een override instelt in het profiel. */
export const DEFAULT_NIBUD_MAPPING: Record<string, NibudPostId> = {
  wonen: "wonen",
  verzekeringen: "verzekeringen",
  abonnementen: "abonnementen-contributies",
  belastingen: "gemeentelijke-heffingen",
  boodschappen: "voeding",
  vervoer: "vervoer",
  gezondheid: "niet-vergoede-ziektekosten",
  kleding: "kleding",
  vrijetijd: "recreatie",
  // bewust niet gemapt: inkomen, sparen, overboekingen, aflossingen, overig
};

/* De effectieve Nibud-post voor een categorie: profiel-override gaat vóór de
 * standaardmapping. `null` (expliciete override) betekent: niet vergelijken. */
export function postForCategory(
  categoryId: string,
  profile: HouseholdProfile | null | undefined,
): NibudPostId | null {
  const overrides = profile?.categoryMapOverrides;
  if (overrides && categoryId in overrides) return overrides[categoryId] ?? null;
  return DEFAULT_NIBUD_MAPPING[categoryId] ?? null;
}
