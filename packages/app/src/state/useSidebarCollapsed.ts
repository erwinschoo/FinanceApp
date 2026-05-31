import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "bokkiep:sidebar-collapsed";

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false; // default: uitgeklapt
  }
}

function apply(collapsed: boolean) {
  const root = document.documentElement;
  if (collapsed) root.dataset.sidebarCollapsed = "true";
  else delete root.dataset.sidebarCollapsed;
}

/* Onthoudt of de desktop-sidebar ingeklapt is: bewaart in localStorage en zet
 * data-sidebar-collapsed op <html>. CSS in app.css reageert daarop (desktop-only).
 * Analoog aan useTheme. Default is uitgeklapt. */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState<boolean>(readStored);

  useEffect(() => { apply(collapsed); }, [collapsed]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* genegeerd */ }
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
