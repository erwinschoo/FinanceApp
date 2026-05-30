import { useLiveQuery } from "dexie-react-hooks";
import { useApp, type ViewId } from "../state/AppContext";
import { useTheme } from "../state/useTheme";
import { db } from "../db/schema";
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

/* "gesynct 14:32" (vandaag) of "gesynct 28 mei" (anders). */
function syncedLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const when = sameDay
    ? d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
  return `gesynct ${when}`;
}

export function Sidebar() {
  const { view, setView, uncategorizedCount } = useApp();
  const { theme, toggle } = useTheme();

  const account = useLiveQuery(() => db.meta.get("account"), [], undefined);
  const syncMeta = useLiveQuery(() => db.meta.get("sync"), [], undefined);
  const acc = account?.value as { email?: string; name?: string } | undefined;
  const connected = !!acc?.email;
  const lastSynced = (syncMeta?.value as { lastSyncedAt?: string } | undefined)?.lastSyncedAt;
  const status = connected
    ? (lastSynced ? syncedLabel(lastSynced) : "OneDrive verbonden")
    : "Lokaal opgeslagen";
  const displayName = connected ? (acc?.email ?? acc?.name ?? "Verbonden") : "Niet verbonden";

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

      <div className="sb-actions">
        <button
          className="theme-toggle"
          onClick={toggle}
          title={theme === "dark" ? "Lichte modus" : "Donkere modus"}
          aria-label="Donkere modus aan/uit"
        >
          <Ic name={theme === "dark" ? "sun" : "moon"} />
        </button>
      </div>

      <div className="sb-foot">
        <div className="sb-user">
          <div className="av">ES</div>
          <div className="meta">
            <div className="nm" title={displayName}>{displayName}</div>
            <div className={"em" + (connected ? " online" : "")} title={connected ? "Verbonden met OneDrive" : "Alleen op dit apparaat opgeslagen"}>
              <Ic name="onedrive" style={!connected ? { color: "var(--faint)" } : undefined} />
              <span className="em-txt">{status}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
