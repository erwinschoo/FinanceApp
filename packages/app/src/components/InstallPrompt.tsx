import { useEffect, useState } from "react";
import { Ic } from "./Ic";
import goatLogo from "../assets/ibex-orange.png";
import { useInstallState, promptInstall, snooze, snoozed } from "../pwa/install";

/* Toont bij het openen een popup om bokkiep als app te installeren (desktop én
 * mobiel), mits: nog niet geïnstalleerd en niet recent weggeklikt. De install-
 * logica zelf zit gedeeld in ../pwa/install. */
export function InstallPrompt() {
  const { installed, canInstall, isIos } = useInstallState();
  const [dismissed, setDismissed] = useState(() => snoozed());
  const [iosReady, setIosReady] = useState(false);

  // iOS kent geen beforeinstallprompt → na een korte vertraging instructies tonen.
  useEffect(() => {
    if (!isIos) return;
    const t = window.setTimeout(() => setIosReady(true), 1200);
    return () => clearTimeout(t);
  }, [isIos]);

  if (installed || dismissed) return null;
  const iosHelp = isIos && iosReady;
  if (!canInstall && !iosHelp) return null;

  async function install() {
    await promptInstall(); // bij 'accepted' volgt appinstalled → popup verdwijnt
  }
  function later() {
    snooze();
    setDismissed(true);
  }

  return (
    <div className="modal-overlay" onClick={later}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <img src={goatLogo} width={44} height={44} alt="" aria-hidden="true" style={{ display: "block", objectFit: "contain", flex: "none" }} />
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
            <p>Gebruik bokkiep als een echte app — sneller te openen en zonder browserbalk.</p>
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
