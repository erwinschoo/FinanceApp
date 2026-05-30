import { lazy, Suspense, type ComponentType } from "react";
import { useApp, type ViewId } from "./state/AppContext";
import { Sidebar } from "./components/Sidebar";
import { MonthPicker } from "./components/MonthPicker";
import { Ic } from "./components/Ic";
import { Dashboard } from "./views/Dashboard";
import { Transactions } from "./views/Transactions";
import { Budgets } from "./views/Budgets";
import { Savings } from "./views/Savings";

// Lazy: Import laadt SheetJS (xlsx), Sync laadt MSAL — pas inladen wanneer nodig.
const Import = lazy(() => import("./views/Import").then((m) => ({ default: m.Import })));
const Sync = lazy(() => import("./views/Sync").then((m) => ({ default: m.Sync })));

const META: Record<ViewId, { title: string; sub: string; month: boolean }> = {
  dashboard: { title: "Overzicht", sub: "Je financiële beeld in één oogopslag", month: true },
  transacties: { title: "Transacties", sub: "Controleer en deel je uitgaven in", month: true },
  budgetten: { title: "Budgetten", sub: "Stem je budget af per categorie", month: true },
  spaardoel: { title: "Spaardoelen", sub: "Stel doelen en volg je voortgang", month: false },
  import: { title: "Importeren", sub: "Laad je banktransacties in via Excel", month: false },
  sync: { title: "Synchroniseren", sub: "Back-up en sync via je eigen OneDrive", month: false },
};

const VIEWS: Record<ViewId, ComponentType> = {
  dashboard: Dashboard,
  transacties: Transactions,
  budgetten: Budgets,
  spaardoel: Savings,
  import: Import,
  sync: Sync,
};

export default function App() {
  const { ready, view, setView } = useApp();

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
      <Sidebar />
      <div className="main">
        <header className="topbar">
          <div>
            <h1>{meta.title}</h1>
            <div className="sub">{meta.sub}</div>
          </div>
          <div className="spacer"></div>
          {meta.month && <MonthPicker />}
          {view !== "import" && (
            <button className="btn btn-primary" onClick={() => setView("import")}>
              <Ic name="upload" size={16} /> Importeren
            </button>
          )}
        </header>
        <main className="content scroll">
          <Suspense fallback={<div className="empty">Laden…</div>}>
            <ViewComp />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
