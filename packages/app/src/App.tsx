import { lazy, Suspense, useState, type ComponentType } from "react";
import { useApp, type ViewId } from "./state/AppContext";
import { Sidebar } from "./components/Sidebar";
import { MonthPicker } from "./components/MonthPicker";
import { Ic } from "./components/Ic";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { clearTransactions, clearPayees } from "./db/repo";
import { Dashboard } from "./views/Dashboard";
import { Transactions } from "./views/Transactions";
import { Budgets } from "./views/Budgets";
import { Savings } from "./views/Savings";
import { Payees } from "./views/Payees";

// Lazy: Import laadt SheetJS (xlsx), Sync laadt MSAL — pas inladen wanneer nodig.
const Import = lazy(() => import("./views/Import").then((m) => ({ default: m.Import })));
const Sync = lazy(() => import("./views/Sync").then((m) => ({ default: m.Sync })));
const Manage = lazy(() => import("./views/Manage").then((m) => ({ default: m.Manage })));

const META: Record<ViewId, { title: string; sub: string; month: boolean }> = {
  dashboard: { title: "Overzicht", sub: "Je financiële beeld in één oogopslag", month: true },
  transacties: { title: "Transacties", sub: "Controleer en deel je uitgaven in", month: false },
  budgetten: { title: "Budgetten", sub: "Stem je budget af per categorie", month: true },
  spaardoel: { title: "Spaardoelen", sub: "Stel doelen en volg je voortgang", month: false },
  tegenpartijen: { title: "Tegenpartijen", sub: "Wijs per winkel of rekening één keer een categorie toe", month: false },
  import: { title: "Importeren", sub: "Laad je banktransacties in via Excel", month: false },
  sync: { title: "Synchroniseren", sub: "Back-up en sync via je eigen OneDrive", month: false },
  beheer: { title: "Beheer", sub: "Categorieën en categoriseer-regels onderhouden", month: false },
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
};

export default function App() {
  const { ready, view, setView } = useApp();
  const [confirm, setConfirm] = useState<null | "transacties" | "tegenpartijen">(null);

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
          {(view === "transacties" || view === "tegenpartijen") && (
            <button className="btn" style={{ marginLeft: 4 }} onClick={() => setConfirm(view)} title="Alle records permanent verwijderen">
              <Ic name="trash" size={16} /> Alles wissen
            </button>
          )}
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
    </div>
  );
}
