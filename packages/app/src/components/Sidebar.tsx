import { useState } from "react";
import { useApp, type ViewId } from "../state/AppContext";
import { useSidebarCollapsed } from "../state/useSidebarCollapsed";
import { useMediaQuery } from "../charts/useMediaQuery";
import { useInstallState } from "../pwa/install";
import { useAutoSyncStatus } from "../sync/autoSync";
import { useKeepMeta } from "../db/keep";
import { Ic } from "./Ic";
import goatLogo from "../assets/ibex-orange.png";

interface NavItem { id: ViewId; label: string; icon: string; tip: string }

// Overzicht staat altijd los bovenaan (boven een divider).
const TOP: NavItem[] = [
  { id: "dashboard", label: "Overzicht", icon: "dashboard", tip: "Je financiële beeld in één oogopslag" },
];
// Primaire schermen (geen kop) — alfabetisch.
const PRIMARY: NavItem[] = [
  { id: "budgetten", label: "Budgetten", icon: "sliders", tip: "Stem je budget af per categorie" },
  { id: "spaardoel", label: "Spaardoelen", icon: "target", tip: "Stel doelen en volg je voortgang" },
  { id: "vergelijken", label: "Vergelijken", icon: "scale", tip: "Zet je uitgaven af tegen een vergelijkbaar huishouden (Nibud)" },
];
const DATA: NavItem[] = [
  { id: "beheer", label: "Beheer", icon: "settings", tip: "Categorieën en categoriseer-regels onderhouden" },
  { id: "import", label: "Importeren", icon: "upload", tip: "Laad je banktransacties in via Excel" },
  { id: "sync", label: "Synchroniseren", icon: "cloud", tip: "Back-up en sync via je eigen OneDrive" },
  { id: "tegenpartijen", label: "Tegenpartijen", icon: "wallet", tip: "Wijs per winkel of rekening één keer een categorie toe" },
  { id: "transacties", label: "Transacties", icon: "list", tip: "Controleer en deel je uitgaven in" },
];
const OVERIG: NavItem[] = [
  { id: "download", label: "Download app", icon: "download", tip: "Installeer bokkiep als app" },
  { id: "feedback", label: "Feedback & bugs", icon: "feedback", tip: "Meld een idee of bug" },
  { id: "informatie", label: "Informatie", icon: "info", tip: "Over bokkiep: uitleg en veelgestelde vragen" },
  { id: "profiel", label: "Profiel & instellingen", icon: "user", tip: "Je huishouden, categorie-koppeling en weergave" },
  { id: "steun", label: "Steun bokkiep", icon: "heart", tip: "Steun de ontwikkeling van bokkiep" },
];

// Alfabetisch (NL) — defensief, zodat de lijsten gesorteerd blijven ongeacht de bronvolgorde.
const byLabel = (a: NavItem, b: NavItem) => a.label.localeCompare(b.label, "nl");

/* Initialen afgeleid van de account-naam (val terug op het e-mailadres). */
function initialsFrom(name?: string, email?: string): string {
  const n = (name ?? "").trim();
  if (n) {
    const parts = n.split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
    return (first + last).toUpperCase() || "?";
  }
  const local = (email ?? "").split("@")[0].replace(/[^a-zA-Z]/g, "");
  return (local.slice(0, 2) || "?").toUpperCase();
}

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
  const { collapsed, toggle: toggleCollapsed } = useSidebarCollapsed();
  // Mobiel: Data en Overig zijn inklapbaar (accordion — max. één tegelijk open).
  const isMobile = useMediaQuery("(max-width: 860px)");
  const [openSection, setOpenSection] = useState<"data" | "overig" | null>(null);
  const { installed } = useInstallState();

  // "Download app" alleen tonen zolang de app niet geïnstalleerd is.
  const overig = installed ? OVERIG.filter((it) => it.id !== "download") : OVERIG;

  const syncState = useAutoSyncStatus();
  const acc = useKeepMeta<{ email?: string; name?: string }>("account");
  const syncMeta = useKeepMeta<{ lastSyncedAt?: string }>("sync");
  const photoMeta = useKeepMeta<{ dataUrl?: string }>("accountPhoto");
  const connected = !!acc?.email;
  const photo = connected ? photoMeta?.dataUrl : undefined;
  const lastSynced = syncMeta?.lastSyncedAt;
  const displayName = connected ? (acc?.email ?? acc?.name ?? "Verbonden") : "Niet verbonden";

  // Status-regel onder de naam: toont achtergrond-sync-activiteit/fouten of de laatste sync-tijd.
  let status: string;
  let statusColor: string | undefined;
  if (!connected) {
    status = "Lokaal opgeslagen";
  } else if (syncState === "locked") {
    status = "Vergrendeld – ontgrendel"; statusColor = "var(--warn)";
  } else if (syncState === "syncing") {
    status = "Synchroniseren…";
  } else if (syncState === "error") {
    status = "Sync mislukt"; statusColor = "var(--over)";
  } else if (syncState === "offline") {
    status = "Offline – wacht"; statusColor = "var(--warn)";
  } else {
    status = lastSynced ? syncedLabel(lastSynced) : "OneDrive verbonden";
  }
  const locked = connected && syncState === "locked";
  const iconStyle = !connected ? { color: "var(--faint)" } : statusColor ? { color: statusColor } : undefined;

  // sectionKey = de groep waarin dit item staat (null voor de losse top-items). Bij een klik
  // zetten we openSection erop: navigeren naar een scherm buiten de open groep klapt die dicht.
  const item = (it: NavItem, sectionKey: "data" | "overig" | null = null) => (
    <button key={it.id} className={"nav-item" + (view === it.id ? " active" : "")} onClick={() => { setView(it.id); setOpenSection(sectionKey); onNavigate?.(); }}>
      <Ic name={it.icon} />
      <span className="nav-label">{it.label}</span>
      {it.id === "transacties" && uncategorizedCount ? <span className="nav-badge">{uncategorizedCount}</span> : null}
      <span className="nav-tip">{it.tip}</span>
    </button>
  );

  // Menusectie met kopje. Inklapbaar (accordion, max. één tegelijk) op mobiel én desktop. Alleen in
  // de ingeklapte desktop-icoonrail tonen we alles statisch — daar past geen accordion.
  const section = (key: "data" | "overig", label: string, items: NavItem[]) => {
    const navEl = <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>{items.map((it) => item(it, key))}</nav>;
    if (!isMobile && collapsed) return <>{<div className="sb-sec">{label}</div>}{navEl}</>;
    const isOpen = openSection === key;
    return (
      <>
        <button className={"sb-sec sb-sec-btn" + (isOpen ? " open" : "")} aria-expanded={isOpen}
          onClick={() => setOpenSection((prev) => (prev === key ? null : key))}>
          <span>{label}</span>
          <Ic name="chevronDown" size={16} />
        </button>
        {isOpen && navEl}
      </>
    );
  };

  return (
    <aside className={"sb" + (open ? " open" : "")}>
      <div className="sb-brand">
        <img className="goat" src={goatLogo} width={34} height={34} alt="" aria-hidden="true" style={{ display: "block", objectFit: "contain" }} />
        <span className="wm">bokkiep</span>
        <button className="sb-collapse" onClick={toggleCollapsed}
          aria-label={collapsed ? "Menu uitklappen" : "Menu inklappen"} aria-expanded={!collapsed}>
          <Ic name={collapsed ? "chevronsRight" : "chevronsLeft"} />
          <span className="nav-tip">{collapsed ? "Menu uitklappen" : "Menu inklappen"}</span>
        </button>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>{TOP.map((it) => item(it))}</nav>
      <div className="sb-divider" />
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>{[...PRIMARY].sort(byLabel).map((it) => item(it))}</nav>

      {section("data", "Data", [...DATA].sort(byLabel))}
      {section("overig", "Overig", [...overig].sort(byLabel))}

      <div className="sb-foot">
        <button type="button" className="sb-user sb-user-btn"
          onClick={() => { setView(locked ? "sync" : "profiel"); onNavigate?.(); }}
          aria-label={locked ? "Ontgrendelen" : "Profiel & instellingen openen"}
          title={locked ? "Ontgrendel je versleutelde data" : "Profiel & instellingen"}>
          <div className={"av" + (connected ? "" : " av-empty")}>
            {photo
              ? <img className="av-photo" src={photo} alt="" />
              : connected
                ? initialsFrom(acc?.name, acc?.email)
                : <Ic name="user" size={18} />}
          </div>
          <div className="meta">
            <div className="nm" title={displayName}>{displayName}</div>
            <div className={"em" + (connected ? " online" : "") + (connected && syncState === "syncing" ? " syncing" : "")} title={connected ? "Verbonden met OneDrive" : "Alleen op dit apparaat opgeslagen"}>
              <Ic name={locked ? "lock" : "onedrive"} style={iconStyle} />
              <span className="em-txt">{status}</span>
            </div>
          </div>
        </button>
      </div>
    </aside>
  );
}
