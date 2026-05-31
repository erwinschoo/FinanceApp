import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "bokkiep:theme";
const LEGACY_KEY = "financeapp:theme"; // voorkeur van vóór de rebrand
// Browser/PWA-chrome (statusbalk): blauw in light mode, zwart in dark mode.
const THEME_COLOR: Record<Theme, string> = { light: "#5E81B5", dark: "#000000" };

function readStored(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    return v === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.dataset.theme = "dark";
  else delete root.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

/* Beheert de licht/donker-voorkeur: onthoudt in localStorage en zet data-theme op <html>.
 * CSS in app.css doet de rest globaal. Default is licht. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readStored);

  // Houd het DOM-attribuut in sync (ook als de inline-script in index.html al iets zette).
  useEffect(() => { apply(theme); }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* genegeerd */ }
      return next;
    });
  }, []);

  return { theme, toggle };
}
