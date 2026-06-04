import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/schema";
import type { HouseholdProfile } from "../db/types";

const PROFILE_KEY = "profile";

/* Verstandige standaard zodat de Nibud-vergelijking out-of-the-box werkt,
 * ook als de gebruiker het profiel nog niet expliciet heeft aangepast. */
export const DEFAULT_PROFILE: HouseholdProfile = {
  adults: 1, children: 0, incomeBand: "modaal", housing: "huur", hasCar: false,
};

/* Live het opgeslagen huishoudprofiel. `undefined` zolang nog niet geladen,
 * `null` wanneer er (nog) geen profiel is ingevuld. */
export function useProfile(): HouseholdProfile | null | undefined {
  return useLiveQuery(async () => {
    const row = await db.meta.get(PROFILE_KEY);
    return (row?.value as HouseholdProfile | undefined) ?? null;
  }, [], undefined);
}

/* Lees het profiel eenmalig (buiten React). */
export async function getProfile(): Promise<HouseholdProfile | null> {
  const row = await db.meta.get(PROFILE_KEY);
  return (row?.value as HouseholdProfile | undefined) ?? null;
}

/* Sla het volledige profiel op (overschrijft). */
export async function saveProfile(profile: HouseholdProfile): Promise<void> {
  await db.meta.put({ key: PROFILE_KEY, value: profile });
}
