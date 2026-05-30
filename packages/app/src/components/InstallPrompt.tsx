import { useEffect, useState } from "react";
import { Ic } from "./Ic";

/* Het 'beforeinstallprompt'-event (Chromium/Android/Edge). iOS/Safari kent dit
 * niet — daar tonen we handmatige instructies. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const SNOOZE_KEY = "bokkiep:install-snooze";
const SNOOZE_DAYS = 7;

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isMobile(): boolean {
  return window.matchMedia("(max-width: 860px)").matches;
}
function snoozed(): boolean {
  try {
    const t = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    return Date.now() - t < SNOOZE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}
function snooze(): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now()));
  } catch {
    /* genegeerd */
  }
}

/* Toont bij het openen een popup om bokkiep als app te installeren, mits:
 * nog niet geïnstalleerd, op een mobiel scherm en niet recent weggeklikt. */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone() || !isMobile() || snoozed()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // onderdruk de standaard mini-infobar; wij tonen eigen UI
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    const onInstalled = () => {
      setShow(false);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // iOS heeft geen beforeinstallprompt → na een korte vertraging instructies tonen.
    let t: number | undefined;
    if (isIos()) {
      t = window.setTimeout(() => {
        setIosHelp(true);
        setShow(true);
      }, 1200);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      if (t) clearTimeout(t);
    };
  }, []);

  if (!show) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice; // 'accepted' → appinstalled volgt; 'dismissed' → niets
    setShow(false);
    setDeferred(null);
  }
  function later() {
    snooze();
    setShow(false);
  }

  return (
    <div className="modal-overlay" onClick={later}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: "var(--blue-soft)", color: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <Ic name="download" size={24} />
          </span>
          <h3 style={{ margin: 0 }}>bokkiep installeren</h3>
        </div>

        {iosHelp ? (
          <>
            <p style={{ marginBottom: 12 }}>Zet bokkiep op je beginscherm om hem als app te gebruiken — zonder browserbalk.</p>
            <ol style={{ margin: "0 0 20px", paddingLeft: 20, fontSize: 14, color: "var(--body)", lineHeight: 1.75 }}>
              <li>Tik op de deel-knop <Ic name="share" size={15} style={{ verticalAlign: "-2px", color: "var(--blue)" }} /> onderaan in Safari.</li>
              <li>Kies <b>Zet op beginscherm</b>.</li>
              <li>Tik op <b>Voeg toe</b>.</li>
            </ol>
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={later}>Begrepen</button>
          </>
        ) : (
          <>
            <p>Gebruik bokkiep als een echte app op je telefoon — sneller te openen en zonder browserbalk.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn" style={{ flex: 1, justifyContent: "center" }} onClick={later}>Niet nu</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={install}>
                <Ic name="download" size={16} /> Installeren
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
