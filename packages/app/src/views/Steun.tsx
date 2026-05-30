import { Ic } from "../components/Ic";
import goatLogo from "../assets/ibex-orange.png";

/* Donatielink (bunq.me, iDEAL). Eén plek om te wijzigen. */
const DONATE_URL = "https://bunq.me/EHSchoo";

const POINTS: [string, string][] = [
  ["check", "100% gratis — geen advertenties, geen tracking."],
  ["onedrive", "Local-first: je gegevens blijven op je eigen apparaat en syncen alleen naar je eigen OneDrive."],
  ["sparkle", "Importeer je bank-export, categoriseer automatisch, budgetteer en volg je spaardoelen."],
];

export function Steun() {
  return (
    <div className="content-inner fade-in" style={{ maxWidth: 640 }}>
      <div className="card card-pad" style={{ textAlign: "center", padding: "32px 28px" }}>
        <img src={goatLogo} width={72} height={72} alt="" style={{ display: "block", margin: "0 auto 14px", objectFit: "contain" }} />
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", margin: "0 0 8px", letterSpacing: "-.02em" }}>Steun bokkiep</h2>
        <p style={{ fontSize: 14.5, color: "var(--body)", lineHeight: 1.6, margin: "0 auto 22px", maxWidth: 460 }}>
          bokkiep is gratis en wordt in vrije tijd ontwikkeld. Vind je de app handig? Met een kleine bijdrage help je de
          verdere ontwikkeling — volledig optioneel, de app blijft altijd gratis.
        </p>
        <a className="btn btn-orange" href={DONATE_URL} target="_blank" rel="noopener noreferrer"
          style={{ textDecoration: "none", padding: "12px 22px", fontSize: 15 }}>
          <Ic name="heart" size={18} /> Doneer via iDEAL
        </a>

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
