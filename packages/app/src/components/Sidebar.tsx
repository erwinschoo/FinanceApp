import { useApp, type ViewId } from "../state/AppContext";
import { Ic } from "./Ic";

interface NavItem { id: ViewId; label: string; icon: string; tip: string }

const MAIN: NavItem[] = [
  { id: "dashboard", label: "Overzicht", icon: "dashboard", tip: "Je financiële beeld in één oogopslag" },
  { id: "transacties", label: "Transacties", icon: "list", tip: "Controleer en deel je uitgaven in" },
  { id: "budgetten", label: "Budgetten", icon: "sliders", tip: "Stem je budget af per categorie" },
  { id: "spaardoel", label: "Spaardoelen", icon: "target", tip: "Stel doelen en volg je voortgang" },
  { id: "tegenpartijen", label: "Tegenpartijen", icon: "wallet", tip: "Wijs per winkel of rekening één keer een categorie toe" },
];
const DATA: NavItem[] = [
  { id: "import", label: "Importeren", icon: "upload", tip: "Laad je banktransacties in via Excel" },
  { id: "sync", label: "Synchroniseren", icon: "cloud", tip: "Back-up en sync via je eigen OneDrive" },
  { id: "beheer", label: "Beheer", icon: "sliders", tip: "Categorieën en categoriseer-regels onderhouden" },
];

export function Sidebar() {
  const { view, setView, uncategorizedCount } = useApp();

  const item = (it: NavItem) => (
    <button key={it.id} className={"nav-item" + (view === it.id ? " active" : "")} onClick={() => setView(it.id)}>
      <Ic name={it.icon} />
      <span>{it.label}</span>
      {it.id === "transacties" && uncategorizedCount ? <span className="nav-badge">{uncategorizedCount}</span> : null}
      <span className="nav-tip">{it.tip}</span>
    </button>
  );

  return (
    <aside className="sb">
      <div className="sb-brand">
        <span className="wm">Finance<b>App</b></span>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>{MAIN.map(item)}</nav>

      <div className="sb-sec">Data</div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>{DATA.map(item)}</nav>

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
