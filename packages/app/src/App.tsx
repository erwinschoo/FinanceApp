import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from "react";
import { useApp, type ViewId } from "./state/AppContext";
import { runStartupSync } from "./sync/autoSync";
import { initOpenWithHandlers } from "./import/incoming";
import { Sidebar } from "./components/Sidebar";
import { MonthPicker } from "./components/MonthPicker";
import { Ic } from "./components/Ic";
import { Button } from "./components/Button";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { InstallPrompt } from "./components/InstallPrompt";
import { clearTransactions, clearPayees } from "./db/repo";
import { Dashboard } from "./views/Dashboard";
import { Transactions } from "./views/Transactions";
import { Budgets } from "./views/Budgets";
import { Savings } from "./views/Savings";
import { Payees } from "./views/Payees";
import { Steun } from "./views/Steun";
import { Download } from "./views/Download";
import { Informatie } from "./views/Informatie";

// Lazy: Import laadt SheetJS (xlsx), Sync laadt MSAL — pas inladen wanneer nodig.
const Import = lazy(() => import("./views/Import").then((m) => ({ default: m.Import })));
const Sync = lazy(() => import("./views/Sync").then((m) => ({ default: m.Sync })));
const Manage = lazy(() => import("./views/Manage").then((m) => ({ default: m.Manage })));

const META: Record<ViewId, { title: string; month: boolean }> = {
  dashboard: { title: "Overzicht", month: true },
  transacties: { title: "Transacties", month: false },
  budgetten: { title: "Budgetten", month: true },
  spaardoel: { title: "Spaardoelen", month: false },
  tegenpartijen: { title: "Tegenpartijen", month: false },
  import: { title: "Importeren", month: false },
  sync: { title: "Synchroniseren", month: false },
  beheer: { title: "Beheer", month: false },
  steun: { title: "Steun bokkiep", month: false },
  download: { title: "Download app", month: false },
  informatie: { title: "Informatie", month: false },
};

const VIEWS: Record<ViewId, ComponentType> = {
  dashboard: Dashboard,
  transacties: Transactions,
  budgetten: Budgets,
  spaardoel: Savings,
  tegenpartijen: Payees,
  import: Import,
  sync: Sync,
  beheer: Manage,
  steun: Steun,
  download: Download,
  informatie: Informatie,
};

export default function App() {
  const { ready, view, setView } = useApp();
  const [confirm, setConfirm] = useState<null | "transacties" | "tegenpartijen">(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const contentRef = useRef<HTMLElement>(null);

  // Bij navigatie naar een ander scherm: altijd bovenaan beginnen. Op desktop scrollt .content,
  // op mobiel het venster zelf (.main is daar overflow:visible) — daarom beide resetten.
  useEffect(() => { contentRef.current?.scrollTo(0, 0); window.scrollTo(0, 0); }, [view]);

  // Bij app-start: stil de nieuwste cloud-versie ophalen (alleen indien ingelogd).
  useEffect(() => { void runStartupSync(); }, []);

  // "Openen met bokkiep" (Android deel-knop / desktop File Handling): zodra een CSV/Excel binnenkomt,
  // naar de import-view en het bestand aan de wizard aanbieden. setView is een stabiele useCallback.
  useEffect(() => { initOpenWithHandlers(() => setView("import")); }, [setView]);

  // Mobiel: drawer sluiten met Escape.
  useEffect(() => {
    if (!drawerOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [drawerOpen]);

  if (!ready) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontWeight: 700 }}>
        Laden…
      </div>
    );
  }

  const meta = META[view];
  const ViewComp = VIEWS[view];

  return (
    <div className="app">
      <Sidebar open={drawerOpen} onNavigate={() => setDrawerOpen(false)} />
      {drawerOpen && <div className="drawer-scrim" onClick={() => setDrawerOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="topbar-burger" onClick={() => setDrawerOpen(true)} aria-label="Menu openen">
            <Ic name="menu" size={22} />
          </button>
          <div className="topbar-title" onClick={() => setDrawerOpen(true)}>
            <h1>{meta.title}</h1>
          </div>
          {(view === "transacties" || view === "tegenpartijen") && (
            <Button style={{ marginLeft: 4 }} onClick={() => setConfirm(view)} title="Alle records permanent verwijderen" icon="trash">
              <span className="btn-label">Alles wissen</span>
            </Button>
          )}
          <div className="spacer"></div>
          {meta.month && <div className="month-slot"><MonthPicker /></div>}
          {view !== "import" && view !== "steun" && view !== "download" && view !== "informatie" && (
            <Button variant="primary" onClick={() => setView("import")} title="Importeren" icon="upload">
              <span className="btn-label">Importeren</span>
            </Button>
          )}
        </header>
        <main className="content scroll" ref={contentRef}>
          <Suspense fallback={<div className="empty">Laden…</div>}>
            <ViewComp />
          </Suspense>
        </main>
      </div>

      <ConfirmDialog
        open={confirm === "transacties"}
        title="Alle transacties verwijderen?"
        message="Hiermee worden ál je transacties en de import-historie permanent verwijderd. Deze actie kan niet ongedaan worden gemaakt."
        confirmLabel="Verwijder transacties"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { await clearTransactions(); setConfirm(null); }}
      />
      <ConfirmDialog
        open={confirm === "tegenpartijen"}
        title="Alle tegenpartijen verwijderen?"
        message="Hiermee worden alle opgeslagen tegenpartij-categorieën permanent verwijderd. Je transacties blijven staan, maar de onthouden koppelingen verdwijnen. Deze actie kan niet ongedaan worden gemaakt."
        confirmLabel="Verwijder tegenpartijen"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { await clearPayees(); setConfirm(null); }}
      />

      <InstallPrompt />

      {/* Kleurt de onderste systeem-/navigatiebalk (Android safe-area) zwart in elk thema. */}
      <div className="safe-bottom" />
    </div>
  );
}
