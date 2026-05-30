import { useApp, type ViewId } from "../state/AppContext";
import { Ic } from "./Ic";

const NAV: { id: ViewId; label: string; icon: string }[] = [
  { id: "dashboard", label: "Overzicht", icon: "dashboard" },
  { id: "transacties", label: "Transacties", icon: "list" },
  { id: "budgetten", label: "Budgetten", icon: "sliders" },
  { id: "spaardoel", label: "Spaardoelen", icon: "target" },
  { id: "tegenpartijen", label: "Tegenpartijen", icon: "wallet" },
];

export function Sidebar() {
  const { view, setView, uncategorizedCount } = useApp();
  return (
    <aside className="sb">
      <div className="sb-brand">
        <span className="wm">Finance<b>App</b></span>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map((it) => (
          <button key={it.id} className={"nav-item" + (view === it.id ? " active" : "")} onClick={() => setView(it.id)}>
            <Ic name={it.icon} />
            <span>{it.label}</span>
            {it.id === "transacties" && uncategorizedCount ? <span className="nav-badge">{uncategorizedCount}</span> : null}
          </button>
        ))}
      </nav>

      <div className="sb-sec">Data</div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <button className={"nav-item" + (view === "import" ? " active" : "")} onClick={() => setView("import")}>
          <Ic name="upload" />
          <span>Importeren</span>
        </button>
        <button className={"nav-item" + (view === "sync" ? " active" : "")} onClick={() => setView("sync")}>
          <Ic name="cloud" />
          <span>Synchroniseren</span>
        </button>
      </nav>

      <div className="sb-foot">
        <div className="sb-user">
          <div className="av">ES</div>
          <div>
            <div className="nm">Mijn huishouden</div>
            <div className="em">lokaal opgeslagen</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
