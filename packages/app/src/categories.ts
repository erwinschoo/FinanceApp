import type { Category } from "./db/types";

/* Canonieke categorielijst — geseed bij eerste start.
 * Identiek aan het prototype + een 'sparen'-categorie ("pay yourself first"). */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: "inkomen",       name: "Inkomen",       color: "var(--pos)",   tint: "var(--pos-soft)",    initial: "€", type: "inkomen" },
  { id: "boodschappen",  name: "Boodschappen",  color: "var(--cat-1)", tint: "var(--orange-soft)", initial: "B", type: "uitgave" },
  { id: "wonen",         name: "Wonen",         color: "var(--cat-2)", tint: "var(--blue-soft)",   initial: "W", type: "uitgave" },
  { id: "vervoer",       name: "Vervoer",       color: "var(--cat-3)", tint: "#ECF3F1",            initial: "V", type: "uitgave" },
  { id: "abonnementen",  name: "Abonnementen",  color: "var(--cat-4)", tint: "#F2EFF7",            initial: "A", type: "uitgave" },
  { id: "gezondheid",    name: "Gezondheid",    color: "var(--cat-5)", tint: "#EBF1F2",            initial: "G", type: "uitgave" },
  { id: "vrijetijd",     name: "Vrije tijd",    color: "var(--cat-6)", tint: "#F7EEF1",            initial: "T", type: "uitgave" },
  { id: "verzekeringen", name: "Verzekeringen", color: "var(--cat-7)", tint: "#FAF1E6",            initial: "Z", type: "uitgave" },
  { id: "overig",        name: "Overig",        color: "var(--cat-8)", tint: "#F1F2F4",            initial: "O", type: "uitgave" },
  { id: "sparen",        name: "Sparen",        color: "var(--cat-4)", tint: "#F2EFF7",            initial: "S", type: "sparen"  },
];
