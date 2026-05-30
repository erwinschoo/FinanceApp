import { Ic } from "../components/Ic";
import goatLogo from "../assets/ibex-orange.png";
import { useInstallState, promptInstall } from "../pwa/install";

/* Voordelen van installeren + wat er met je gegevens gebeurt. */
const POINTS: [string, string][] = [
  ["onedrive", "Installeren verstuurt niets: je gegevens blijven local-first op dit apparaat (in de browseropslag) en gaan alleen naar je eigen OneDrive als je synchroniseren zelf inschakelt."],
  ["sparkle", "Sneller te openen vanaf je beginscherm of bureaublad, zonder browserbalk."],
  ["check", "Werkt ook offline en blijft automatisch up-to-date — het is dezelfde app, alleen als zelfstandig venster."],
];

/* Handmatige instructies per platform (gebruikt wanneer de browser geen
 * automatische installatie aanbiedt, o.a. iOS/Safari). */
function Instructions({ ios }: { ios: boolean }) {
  if (ios) {
    return (
      <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "var(--body)", lineHeight: 1.8 }}>
        <li>Tik op de deel-knop <Ic name="share" size={15} style={{ verticalAlign: "-2px", color: "var(--blue)" }} /> onderaan in Safari.</li>
        <li>Kies <b>Zet op beginscherm</b>.</li>
        <li>Tik op <b>Voeg toe</b>.</li>
      </ol>
    );
  }
  return (
    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "var(--body)", lineHeight: 1.8 }}>
      <li><b>Chrome / Edge (desktop):</b> klik op het installatie-icoon in de adresbalk, of via het menu → "App installeren".</li>
      <li><b>Android (Chrome):</b> tik op het menu (⋮) → "App installeren" of "Toevoegen aan startscherm".</li>
      <li><b>Andere browsers:</b> zoek in het menu naar "Installeren" of "Toevoegen aan startscherm".</li>
    </ul>
  );
}

export function Download() {
  const { canInstall, isIos } = useInstallState();

  return (
    <div className="content-inner fade-in" style={{ maxWidth: 640 }}>
      <div className="card card-pad" style={{ textAlign: "center", padding: "32px 28px" }}>
        <img src={goatLogo} width={72} height={72} alt="" style={{ display: "block", margin: "0 auto 14px", objectFit: "contain" }} />
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", margin: "0 0 8px", letterSpacing: "-.02em" }}>Download bokkiep</h2>
        <p style={{ fontSize: 14.5, color: "var(--body)", lineHeight: 1.6, margin: "0 auto 22px", maxWidth: 470 }}>
          bokkiep is een Progressive Web App (PWA). Je kunt hem installeren als zelfstandige app op je
          telefoon, tablet of computer — geen appstore nodig.
        </p>

        {canInstall ? (
          <button className="btn btn-primary" onClick={() => void promptInstall()}
            style={{ padding: "12px 22px", fontSize: 15 }}>
            <Ic name="download" size={18} /> Installeer als app
          </button>
        ) : (
          <div style={{ textAlign: "left", background: "var(--subtle)", border: "1px solid var(--line-soft)", borderRadius: "var(--radius-sm)", padding: "16px 18px" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
              Zo installeer je bokkiep:
            </div>
            <Instructions ios={isIos} />
          </div>
        )}

        <div style={{ marginTop: 28, textAlign: "left", borderTop: "1px solid var(--line-soft)", paddingTop: 22 }}>
          {POINTS.map(([icon, text]) => (
            <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: 11, marginBottom: 12 }}>
              <span style={{ color: "var(--pos)", flex: "none", marginTop: 1 }}><Ic name={icon} size={18} /></span>
              <span style={{ fontSize: 13.5, color: "var(--body)", lineHeight: 1.5 }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
