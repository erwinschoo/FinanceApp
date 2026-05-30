import type { Category } from "./db/types";

/* Canonieke categorielijst (2 niveaus) — geseed bij eerste start.
 * Bestaande ids blijven leaves zodat eerder ingedeelde transacties geldig blijven.
 * Groepen hebben children; leaves hebben parentId of staan top-level. */
export const DEFAULT_CATEGORIES: Category[] = [
  // inkomen
  { id: "inkomen", name: "Inkomen", color: "var(--pos)", tint: "var(--pos-soft)", initial: "€", type: "inkomen", parentId: null },

  // groep: vaste lasten
  { id: "vaste-lasten", name: "Vaste lasten", color: "var(--blue)", tint: "var(--blue-soft)", initial: "V", type: "uitgave", parentId: null },
  { id: "wonen", name: "Wonen", color: "var(--cat-2)", tint: "var(--blue-soft)", initial: "W", type: "uitgave", parentId: "vaste-lasten" },
  { id: "verzekeringen", name: "Verzekeringen", color: "var(--cat-7)", tint: "#FAF1E6", initial: "Z", type: "uitgave", parentId: "vaste-lasten" },
  { id: "abonnementen", name: "Abonnementen", color: "var(--cat-4)", tint: "#F2EFF7", initial: "A", type: "uitgave", parentId: "vaste-lasten" },
  { id: "belastingen", name: "Belastingen", color: "#C7584B", tint: "#FBEEEC", initial: "B", type: "uitgave", parentId: "vaste-lasten" },
  { id: "aflossingen", name: "Aflossingen", color: "#7A6FA8", tint: "#F1EEF7", initial: "A", type: "uitgave", parentId: "vaste-lasten" },

  // top-level uitgaven
  { id: "boodschappen", name: "Boodschappen", color: "var(--cat-1)", tint: "var(--orange-soft)", initial: "B", type: "uitgave", parentId: null },
  { id: "vervoer", name: "Vervoer", color: "var(--cat-3)", tint: "#ECF3F1", initial: "V", type: "uitgave", parentId: null },
  { id: "gezondheid", name: "Gezondheid", color: "var(--cat-5)", tint: "#EBF1F2", initial: "G", type: "uitgave", parentId: null },
  { id: "vrijetijd", name: "Vrije tijd", color: "var(--cat-6)", tint: "#F7EEF1", initial: "T", type: "uitgave", parentId: null },
  { id: "kleding", name: "Kleding & verzorging", color: "#5AA0A8", tint: "#EAF3F4", initial: "K", type: "uitgave", parentId: null },
  { id: "overig", name: "Overig", color: "var(--cat-8)", tint: "#F1F2F4", initial: "O", type: "uitgave", parentId: null },

  // sparen & overboekingen (buiten budget)
  { id: "sparen", name: "Sparen", color: "var(--cat-4)", tint: "#F2EFF7", initial: "S", type: "sparen", parentId: null },
  { id: "overboekingen", name: "Overboekingen", color: "#97A0AB", tint: "#F1F2F4", initial: "↔", type: "overboeking", parentId: null },
];

/* Categorieën die via de v3-migratie aan bestaande databases worden toegevoegd. */
export const ADDED_IN_V3 = ["vaste-lasten", "belastingen", "aflossingen", "kleding", "overboekingen"];

/* parentId-toewijzingen die de v3-migratie op bestaande leaves zet. */
export const V3_PARENTING: Record<string, string> = {
  wonen: "vaste-lasten",
  verzekeringen: "vaste-lasten",
  abonnementen: "vaste-lasten",
  belastingen: "vaste-lasten",
  aflossingen: "vaste-lasten",
};
