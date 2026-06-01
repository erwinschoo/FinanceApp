import type { HouseholdComposition, IncomeBand, NibudPostId } from "../db/types";

/* ─────────────────────────────────────────────────────────────────────────────
 * Nibud-referentiecijfers — gecureerde, statische dataset.
 *
 * BRON: Nibud-voorbeeldbegrotingen (vrij gepubliceerd). Deze bedragen zijn
 * handmatig overgenomen indicaties per maand (€) en GEEN live koppeling met Nibud.
 * Er is geen publieke API/database; dit is bewust statisch en wordt ~jaarlijks
 * handmatig bijgewerkt.
 *
 * ⚠️  De onderstaande bedragen zijn voorbeeld-/richtwaarden. Vóór release moeten ze
 *     geverifieerd worden tegen de actuele Nibud-publicatie van NIBUD_YEAR, en is
 *     het advies Nibud schriftelijk om akkoord te vragen voor hergebruik mét
 *     bronvermelding.
 * ───────────────────────────────────────────────────────────────────────────── */

export const NIBUD_YEAR = 2024;
export const NIBUD_SOURCE_LABEL = "Nibud-voorbeeldbegrotingen";
export const NIBUD_SOURCE_URL = "https://www.nibud.nl/onderwerpen/uitgaven/vergelijk-uitgaven/";

/* Leesbare labels per Nibud-post (voor weergave in de vergelijk-tabel). */
export const NIBUD_POST_LABELS: Record<NibudPostId, string> = {
  "wonen": "Wonen (huur/hypotheek)",
  "energie-water": "Energie & water",
  "gemeentelijke-heffingen": "Gemeentelijke heffingen",
  "telefoon-tv-internet": "Telefoon, tv & internet",
  "verzekeringen": "Verzekeringen",
  "vervoer": "Vervoer",
  "voeding": "Voeding & boodschappen",
  "kleding": "Kleding & schoenen",
  "niet-vergoede-ziektekosten": "Niet-vergoede ziektekosten",
  "abonnementen-contributies": "Abonnementen & contributies",
  "inventaris-onderhoud": "Inventaris & onderhoud",
  "recreatie": "Recreatie & vrije tijd",
  "reserveringen": "Reserveringen",
};

export const NIBUD_POST_ORDER: NibudPostId[] = [
  "wonen",
  "energie-water",
  "gemeentelijke-heffingen",
  "telefoon-tv-internet",
  "verzekeringen",
  "vervoer",
  "voeding",
  "kleding",
  "niet-vergoede-ziektekosten",
  "abonnementen-contributies",
  "inventaris-onderhoud",
  "recreatie",
  "reserveringen",
];

export interface NibudHousehold {
  id: string;
  label: string;
  composition: HouseholdComposition;
  incomeBand: IncomeBand;
  /* Indicatief aantal personen (voor auto-match / weergave). */
  adults: number;
  children: number;
  /* Maandbedrag (€) per uitgavenpost. */
  posts: Record<NibudPostId, number>;
}

/* Een handvol voorbeeldhuishoudens. Uitbreidbaar zonder code-wijziging elders. */
export const NIBUD_HOUSEHOLDS: NibudHousehold[] = [
  {
    id: "alleenstaand-minimum",
    label: "Alleenstaand, minimuminkomen",
    composition: "alleenstaand",
    incomeBand: "minimum",
    adults: 1,
    children: 0,
    posts: {
      "wonen": 600,
      "energie-water": 150,
      "gemeentelijke-heffingen": 30,
      "telefoon-tv-internet": 50,
      "verzekeringen": 150,
      "vervoer": 70,
      "voeding": 230,
      "kleding": 55,
      "niet-vergoede-ziektekosten": 25,
      "abonnementen-contributies": 25,
      "inventaris-onderhoud": 90,
      "recreatie": 80,
      "reserveringen": 70,
    },
  },
  {
    id: "alleenstaand-modaal",
    label: "Alleenstaand, modaal inkomen",
    composition: "alleenstaand",
    incomeBand: "modaal",
    adults: 1,
    children: 0,
    posts: {
      "wonen": 800,
      "energie-water": 170,
      "gemeentelijke-heffingen": 35,
      "telefoon-tv-internet": 60,
      "verzekeringen": 165,
      "vervoer": 130,
      "voeding": 260,
      "kleding": 80,
      "niet-vergoede-ziektekosten": 30,
      "abonnementen-contributies": 45,
      "inventaris-onderhoud": 120,
      "recreatie": 160,
      "reserveringen": 110,
    },
  },
  {
    id: "paar-modaal",
    label: "Paar zonder kinderen, modaal inkomen",
    composition: "paar",
    incomeBand: "modaal",
    adults: 2,
    children: 0,
    posts: {
      "wonen": 900,
      "energie-water": 210,
      "gemeentelijke-heffingen": 45,
      "telefoon-tv-internet": 70,
      "verzekeringen": 310,
      "vervoer": 220,
      "voeding": 460,
      "kleding": 130,
      "niet-vergoede-ziektekosten": 55,
      "abonnementen-contributies": 60,
      "inventaris-onderhoud": 160,
      "recreatie": 250,
      "reserveringen": 160,
    },
  },
  {
    id: "gezin-2k-modaal",
    label: "Gezin met 2 kinderen, modaal inkomen",
    composition: "gezin",
    incomeBand: "modaal",
    adults: 2,
    children: 2,
    posts: {
      "wonen": 1000,
      "energie-water": 250,
      "gemeentelijke-heffingen": 50,
      "telefoon-tv-internet": 75,
      "verzekeringen": 340,
      "vervoer": 260,
      "voeding": 700,
      "kleding": 200,
      "niet-vergoede-ziektekosten": 70,
      "abonnementen-contributies": 90,
      "inventaris-onderhoud": 190,
      "recreatie": 320,
      "reserveringen": 210,
    },
  },
  {
    id: "eenoudergezin-2k-minimum",
    label: "Eenoudergezin met 2 kinderen, minimuminkomen",
    composition: "eenoudergezin",
    incomeBand: "minimum",
    adults: 1,
    children: 2,
    posts: {
      "wonen": 700,
      "energie-water": 200,
      "gemeentelijke-heffingen": 35,
      "telefoon-tv-internet": 60,
      "verzekeringen": 200,
      "vervoer": 110,
      "voeding": 540,
      "kleding": 150,
      "niet-vergoede-ziektekosten": 50,
      "abonnementen-contributies": 55,
      "inventaris-onderhoud": 150,
      "recreatie": 180,
      "reserveringen": 150,
    },
  },
];

/* Kies het best passende voorbeeldhuishouden op basis van samenstelling + inkomen.
 * Valt terug op samenstelling-match, daarna op het eerste huishouden. */
export function matchHousehold(
  composition: HouseholdComposition,
  incomeBand: IncomeBand,
): NibudHousehold {
  return (
    NIBUD_HOUSEHOLDS.find((h) => h.composition === composition && h.incomeBand === incomeBand) ??
    NIBUD_HOUSEHOLDS.find((h) => h.composition === composition) ??
    NIBUD_HOUSEHOLDS[0]
  );
}

/* Leid de samenstelling af uit losse profielvelden (volwassenen + kinderen). */
export function compositionFrom(adults: number, children: number): HouseholdComposition {
  if (children > 0) return adults <= 1 ? "eenoudergezin" : "gezin";
  return adults <= 1 ? "alleenstaand" : "paar";
}
