import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "financeapp:theme";
const THEME_COLOR: Record<Theme, string> = { light: "#5E81B5", dark: "#1F1F1F" };

function readStored(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
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
