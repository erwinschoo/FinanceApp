import type { Category, CategoryGroupRow, CategoryType } from "./db/types";

/* Canonieke categoriegroepen — puur organisatorisch (UX). Geseed bij eerste start. */
export const DEFAULT_GROUPS: CategoryGroupRow[] = [
  { id: "grp-inkomsten", name: "Inkomsten", color: "var(--pos)", order: 0 },
  { id: "grp-vaste-lasten", name: "Vaste lasten", color: "var(--blue)", order: 1 },
  { id: "grp-dagelijks", name: "Dagelijkse uitgaven", color: "var(--cat-1)", order: 2 },
  { id: "grp-vrije-tijd", name: "Vrije tijd & overig", color: "var(--cat-6)", order: 3 },
  { id: "grp-sparen", name: "Sparen & overboekingen", color: "var(--cat-4)", order: 4 },
];

/* Canonieke categorielijst — elke categorie hoort bij precies één groep (groupId).
 * Bestaande ids blijven gelijk zodat eerder ingedeelde transacties geldig blijven. */
export const DEFAULT_CATEGORIES: Category[] = [
  // Inkomsten
  { id: "inkomen", name: "Inkomen", color: "var(--pos)", tint: "var(--pos-soft)", initial: "€", type: "inkomen", groupId: "grp-inkomsten", order: 0 },

  // Vaste lasten
  { id: "wonen", name: "Wonen", color: "var(--cat-2)", tint: "var(--blue-soft)", initial: "W", type: "uitgave", groupId: "grp-vaste-lasten", order: 0 },
  { id: "verzekeringen", name: "Verzekeringen", color: "var(--cat-7)", tint: "#FAF1E6", initial: "Z", type: "uitgave", groupId: "grp-vaste-lasten", order: 1 },
  { id: "abonnementen", name: "Abonnementen", color: "var(--cat-4)", tint: "#F2EFF7", initial: "A", type: "uitgave", groupId: "grp-vaste-lasten", order: 2 },
  { id: "belastingen", name: "Belastingen", color: "#C7584B", tint: "#FBEEEC", initial: "B", type: "uitgave", groupId: "grp-vaste-lasten", order: 3 },
  { id: "aflossingen", name: "Aflossingen", color: "#7A6FA8", tint: "#F1EEF7", initial: "A", type: "uitgave", groupId: "grp-vaste-lasten", order: 4 },

  // Dagelijkse uitgaven
  { id: "boodschappen", name: "Boodschappen", color: "var(--cat-1)", tint: "var(--orange-soft)", initial: "B", type: "uitgave", groupId: "grp-dagelijks", order: 0 },
  { id: "vervoer", name: "Vervoer", color: "var(--cat-3)", tint: "#ECF3F1", initial: "V", type: "uitgave", groupId: "grp-dagelijks", order: 1 },
  { id: "gezondheid", name: "Gezondheid", color: "var(--cat-5)", tint: "#EBF1F2", initial: "G", type: "uitgave", groupId: "grp-dagelijks", order: 2 },
  { id: "kleding", name: "Kleding & verzorging", color: "#5AA0A8", tint: "#EAF3F4", initial: "K", type: "uitgave", groupId: "grp-dagelijks", order: 3 },

  // Vrije tijd & overig
  { id: "vrijetijd", name: "Vrije tijd", color: "var(--cat-6)", tint: "#F7EEF1", initial: "T", type: "uitgave", groupId: "grp-vrije-tijd", order: 0 },
  { id: "overig", name: "Overig", color: "var(--cat-8)", tint: "#F1F2F4", initial: "O", type: "uitgave", groupId: "grp-vrije-tijd", order: 1 },

  // Sparen & overboekingen
  { id: "sparen", name: "Sparen", color: "var(--cat-4)", tint: "#F2EFF7", initial: "S", type: "sparen", groupId: "grp-sparen", order: 0 },
  { id: "overboekingen", name: "Overboekingen", color: "#97A0AB", tint: "#F1F2F4", initial: "↔", type: "overboeking", groupId: "grp-sparen", order: 1 },
];

/* Categorieën die via de v3-migratie aan bestaande databases zijn toegevoegd. */
export const ADDED_IN_V3 = ["vaste-lasten", "belastingen", "aflossingen", "kleding", "overboekingen"];

/* parentId-toewijzingen die de v3-migratie op bestaande leaves zette (legacy). */
export const V3_PARENTING: Record<string, string> = {
  wonen: "vaste-lasten",
  verzekeringen: "vaste-lasten",
  abonnementen: "vaste-lasten",
  belastingen: "vaste-lasten",
  aflossingen: "vaste-lasten",
};

/* ── v5-migratie: van parentId-hiërarchie naar aparte categoriegroepen ── */

/* Expliciete groep per bekende categorie-id. */
export const V5_GROUPING: Record<string, string> = {
  inkomen: "grp-inkomsten",
  wonen: "grp-vaste-lasten",
  verzekeringen: "grp-vaste-lasten",
  abonnementen: "grp-vaste-lasten",
  belastingen: "grp-vaste-lasten",
  aflossingen: "grp-vaste-lasten",
  boodschappen: "grp-dagelijks",
  vervoer: "grp-dagelijks",
  gezondheid: "grp-dagelijks",
  kleding: "grp-dagelijks",
  vrijetijd: "grp-vrije-tijd",
  overig: "grp-vrije-tijd",
  sparen: "grp-sparen",
  overboekingen: "grp-sparen",
};

/* Fallback-groep voor onbekende/eigen categorieën, op basis van hun type. */
export function fallbackGroupForType(type: CategoryType): string {
  switch (type) {
    case "inkomen": return "grp-inkomsten";
    case "sparen":
    case "overboeking": return "grp-sparen";
    default: return "grp-vrije-tijd"; // uitgave
  }
}
