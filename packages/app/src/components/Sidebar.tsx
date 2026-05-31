import { useLiveQuery } from "dexie-react-hooks";
import { useApp, type ViewId } from "../state/AppContext";
import { useTheme } from "../state/useTheme";
import { useInstallState } from "../pwa/install";
import { useAutoSyncStatus } from "../sync/autoSync";
import { db } from "../db/schema";
import { Ic } from "./Ic";
import goatLogo from "../assets/ibex-orange.png";

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
  { id: "beheer", label: "Beheer", icon: "settings", tip: "Categorieën en categoriseer-regels onderhouden" },
];
const OVERIG: NavItem[] = [
  { id: "steun", label: "Steun bokkiep", icon: "heart", tip: "Steun de ontwikkeling van bokkiep" },
  { id: "download", label: "Download app", icon: "download", tip: "Installeer bokkiep als app" },
  { id: "informatie", label: "Informatie", icon: "info", tip: "Over bokkiep: uitleg en veelgestelde vragen" },
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

export function Sidebar({ open = false, onNavigate }: { open?: boolean; onNavigate?: () => void } = {}) {
  const { view, setView, uncategorizedCount } = useApp();
  const { theme, toggle } = useTheme();
  const { installed } = useInstallState();

  // "Download app" alleen tonen zolang de app niet geïnstalleerd is.
  const overig = installed ? OVERIG.filter((it) => it.id !== "download") : OVERIG;

  const syncState = useAutoSyncStatus();
  const account = useLiveQuery(() => db.meta.get("account"), [], undefined);
  const syncMeta = useLiveQuery(() => db.meta.get("sync"), [], undefined);
  const acc = account?.value as { email?: string; name?: string } | undefined;
  const connected = !!acc?.email;
  const lastSynced = (syncMeta?.value as { lastSyncedAt?: string } | undefined)?.lastSyncedAt;
  const displayName = connected ? (acc?.email ?? acc?.name ?? "Verbonden") : "Niet verbonden";

  // Status-regel onder de naam: toont achtergrond-sync-activiteit/fouten of de laatste sync-tijd.
  let status: string;
  let statusColor: string | undefined;
  if (!connected) {
    status = "Lokaal opgeslagen";
  } else if (syncState === "syncing") {
    status = "Synchroniseren…";
  } else if (syncState === "error") {
    status = "Sync mislukt"; statusColor = "var(--over)";
  } else if (syncState === "offline") {
    status = "Offline – wacht"; statusColor = "var(--warn)";
  } else {
    status = lastSynced ? syncedLabel(lastSynced) : "OneDrive verbonden";
  }
  const iconStyle = !connected ? { color: "var(--faint)" } : statusColor ? { color: statusColor } : undefined;

  const item = (it: NavItem) => (
    <button key={it.id} className={"nav-item" + (view === it.id ? " active" : "")} onClick={() => { setView(it.id); onNavigate?.(); }}>
      <Ic name={it.icon} />
      <span>{it.label}</span>
      {it.id === "transacties" && uncategorizedCount ? <span className="nav-badge">{uncategorizedCount}</span> : null}
      <span className="nav-tip">{it.tip}</span>
    </button>
  );

  return (
    <aside className={"sb" + (open ? " open" : "")}>
      <div className="sb-brand">
        <img className="goat" src={goatLogo} width={34} height={34} alt="" aria-hidden="true" style={{ display: "block", objectFit: "contain" }} />
        <span className="wm">bokkiep</span>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>{MAIN.map(item)}</nav>

      <div className="sb-sec">Data</div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>{DATA.map(item)}</nav>

      <div className="sb-sec">Overig</div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>{overig.map(item)}</nav>

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
            <div className={"em" + (connected ? " online" : "") + (connected && syncState === "syncing" ? " syncing" : "")} title={connected ? "Verbonden met OneDrive" : "Alleen op dit apparaat opgeslagen"}>
              <Ic name="onedrive" style={iconStyle} />
              <span className="em-txt">{status}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
