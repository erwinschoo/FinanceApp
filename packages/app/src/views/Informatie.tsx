import { useState } from "react";
import { Ic } from "../components/Ic";
import goatLogo from "../assets/ibex-orange.png";

/* Korte uitleg per hoofdscherm — icoon + omschrijving, in dezelfde volgorde
 * als het menu. */
const SCREENS: [string, string, string][] = [
  ["dashboard", "Overzicht", "Je financiële beeld in één oogopslag: inkomsten, uitgaven en saldo per maand."],
  ["list", "Transacties", "Al je banktransacties op één plek, met filteren, zoeken en categoriseren."],
  ["sliders", "Budgetten", "Stel per categorie een budget in en zie direct hoeveel je nog over hebt."],
  ["target", "Spaardoelen", "Stel doelen in en volg je voortgang; bokkiep verdeelt je spaargeld automatisch."],
  ["wallet", "Tegenpartijen", "Wijs een winkel of rekening één keer een categorie toe en bokkiep onthoudt het."],
  ["upload", "Importeren", "Laad je bank-export (Excel) in; transacties worden automatisch herkend en ingedeeld."],
  ["cloud", "Synchroniseren", "Optionele back-up en sync via je eigen OneDrive — jij houdt de controle."],
  ["sliders", "Beheer", "Onderhoud je categorieën, groepen en categoriseer-regels."],
];

const FAQ: [string, string][] = [
  ["Wat is bokkiep precies?", "bokkiep is een persoonlijk financieel overzicht: je importeert je banktransacties, categoriseert ze, stelt budgetten in en volgt spaardoelen. De app is volledig gratis en bevat geen advertenties of tracking."],
  ["Waar worden mijn gegevens opgeslagen?", "Local-first: al je gegevens blijven op je eigen apparaat, in de opslag van je browser. Er gaat niets naar een server, tenzij je zelf synchroniseren met OneDrive inschakelt."],
  ["Is synchroniseren veilig?", "Ja. Synchroniseren gebeurt uitsluitend met jóuw eigen OneDrive-account. Je gegevens worden niet door anderen ingezien; bokkiep heeft geen eigen server die je data bewaart."],
  ["Hoe importeer ik mijn banktransacties?", "Ga naar Importeren en kies het Excel-bestand dat je via je bank exporteert. bokkiep leest de transacties in en deelt ze waar mogelijk automatisch in op basis van je regels en tegenpartijen."],
  ["Kan ik categorieën aanpassen?", "Zeker. Via Beheer pas je categorieën, groepen en categoriseer-regels aan. Wijzigingen werken door op je hele overzicht."],
  ["Kost het geld?", "Nee, bokkiep is en blijft gratis. Vind je de app handig? Dan kun je de ontwikkeling vrijwillig steunen via de pagina \"Steun bokkiep\"."],
  ["Hoe installeer ik bokkiep als app?", "Open de pagina \"Download app\" in het menu. Daar vind je een installatieknop of instructies per apparaat. Eenmaal geïnstalleerd open je bokkiep als een gewone app, zonder browserbalk."],
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid var(--line-soft)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12, border: "none",
          background: "transparent", cursor: "pointer", padding: "14px 0", textAlign: "left",
          color: "var(--ink)", fontSize: 14.5, fontWeight: 700,
        }}
      >
        <span style={{ flex: "none", color: "var(--muted)" }}>
          <Ic name={open ? "chevronDown" : "chevronRight"} size={18} />
        </span>
        <span style={{ flex: 1 }}>{q}</span>
      </button>
      {open && (
        <p style={{ margin: "0 0 14px", paddingLeft: 30, fontSize: 13.5, color: "var(--body)", lineHeight: 1.6 }}>{a}</p>
      )}
    </div>
  );
}

export function Informatie() {
  return (
    <div className="content-inner fade-in" style={{ maxWidth: 720 }}>
      <div className="card card-pad" style={{ textAlign: "center", padding: "32px 28px", marginBottom: 20 }}>
        <img src={goatLogo} width={72} height={72} alt="" style={{ display: "block", margin: "0 auto 14px", objectFit: "contain" }} />
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", margin: "0 0 8px", letterSpacing: "-.02em" }}>Wat is bokkiep?</h2>
        <p style={{ fontSize: 14.5, color: "var(--body)", lineHeight: 1.6, margin: "0 auto", maxWidth: 520 }}>
          bokkiep is een eenvoudig, privacyvriendelijk financieel overzicht. Importeer je
          banktransacties, categoriseer ze, stel budgetten in en volg je spaardoelen — gratis, zonder
          advertenties of tracking, en met al je gegevens veilig op je eigen apparaat.
        </p>
      </div>

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", margin: "0 0 16px" }}>De schermen</h3>
        {SCREENS.map(([icon, title, desc]) => (
          <div key={title} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            <span style={{ color: "var(--blue)", flex: "none", marginTop: 1 }}><Ic name={icon} size={19} /></span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{title}</div>
              <div style={{ fontSize: 13, color: "var(--body)", lineHeight: 1.5 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card card-pad">
        <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", margin: "0 0 6px" }}>Veelgestelde vragen</h3>
        {FAQ.map(([q, a]) => (
          <FaqItem key={q} q={q} a={a} />
        ))}
      </div>
    </div>
  );
}
