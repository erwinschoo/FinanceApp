import { useEffect, useState } from "react";
import { Ic } from "./Ic";
import { Button } from "./Button";
import { PasswordInput } from "./PasswordInput";
import { keepGet, setEncEnabled } from "../db/keep";
import {
  unlockWithPassphrase, unlockWithRecovery, unlockWithBiometric, hasBiometricSlot,
} from "../sync/encSession";
import { hydrateFromVault, persistVaultNow } from "../db/vault";
import goatLogo from "../assets/ibex-orange.png";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 13px", borderRadius: 10, border: "1px solid var(--line)",
  background: "var(--surface)", color: "var(--ink)", fontSize: 15, marginTop: 10,
};

/* Verplichte ontgrendeling bij app-start wanneer at-rest-versleuteling aanstaat.
 * Niet wegklikbaar: zonder ontgrendelen is er geen (ontsleutelde) data. Na succes
 * worden de gegevens uit de versleutelde vault in de in-memory db gezet en mag de
 * app monten. Password-manager-vriendelijk: een echt <form> met username +
 * autocomplete=current-password; biometrie wanneer er een device-slot is. */
export function UnlockGate({ atRest, onUnlocked }: { atRest: boolean; onUnlocked: () => void }) {
  const [email, setEmail] = useState<string>("");
  const [hasBio, setHasBio] = useState(false);
  const [mode, setMode] = useState<"pass" | "recovery">("pass");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const acc = await keepGet<{ email?: string }>("account");
      setEmail(acc?.email ?? "");
      setHasBio(await hasBiometricSlot());
    })();
  }, []);

  async function finish() {
    if (atRest) {
      // De hoofd-db is in-memory en leeg → vul 'm uit de versleutelde vault.
      await hydrateFromVault();
    } else {
      // Legacy: er was al versleuteling, maar de data stond nog plaintext op schijf.
      // Bouw nu de versleutelde vault uit de huidige data en markeer at-rest. Geen
      // reload: deze sessie draait nog persistent; de volgende start is in-memory en
      // ruimt de plaintext-db op.
      await persistVaultNow();
      await setEncEnabled(true);
    }
    onUnlocked();
  }

  async function doBiometric() {
    setBusy(true); setErr(null);
    try {
      await unlockWithBiometric();
      await finish();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  // Biometrie wordt NIET automatisch getriggerd: anders vuurt de browser bij opstart
  // twee credential-prompts tegelijk af (passkey + wachtwoord-autofill). De gebruiker
  // kiest zelf via de biometrie-knop of het wachtwoordveld → maximaal één prompt tegelijk.

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !value.trim()) return;
    setBusy(true); setErr(null);
    try {
      if (mode === "pass") await unlockWithPassphrase(value);
      else await unlockWithRecovery(value);
      await finish();
    } catch {
      setErr(mode === "pass" ? "Onjuist wachtwoord. Probeer opnieuw." : "Onjuiste herstelcode.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Ontgrendelen"
      style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="modal" style={{ maxWidth: 380, textAlign: "center" }}>
        <img src={goatLogo} width={56} height={56} alt="" style={{ display: "block", margin: "0 auto 10px", objectFit: "contain" }} />
        <h3 style={{ marginBottom: 6 }}>Ontgrendel bokkiep</h3>
        <p style={{ color: "var(--body)", fontSize: 13.5, lineHeight: 1.6, marginTop: 0 }}>
          Je gegevens zijn versleuteld opgeslagen op dit toestel. Voer je wachtwoord in om ze te ontgrendelen.
        </p>

        {err && (
          <div className="notice" style={{ margin: "0 0 12px", background: "var(--over-soft)", borderColor: "#F3D9D5", textAlign: "left" }}>
            <span className="ni" style={{ color: "var(--over)" }}><Ic name="info" size={20} /></span>
            <div className="nt">{err}</div>
          </div>
        )}

        {hasBio && (
          <div style={{ marginBottom: 12 }}>
            <Button variant="primary" icon="fingerprint" disabled={busy} onClick={doBiometric} style={{ width: "100%", justifyContent: "center" }}>
              Ontgrendel met biometrie
            </Button>
          </div>
        )}

        <form onSubmit={onSubmit}>
          {/* Verborgen username helpt wachtwoordmanagers de juiste credential te bewaren/vullen. */}
          <input type="text" name="username" autoComplete="username" value={email} readOnly hidden aria-hidden="true" />
          {mode === "pass" ? (
            <PasswordInput autoComplete="current-password" autoFocus={!hasBio} fontSize={15} style={{ marginTop: 10 }}
              placeholder="Wachtwoord" value={value} onChange={setValue} disabled={busy} ariaLabel="Wachtwoord" />
          ) : (
            <input style={inputStyle} type="text" inputMode="text" autoFocus
              placeholder="Herstelcode (XXXX-XXXX-…)" value={value} onChange={(e) => setValue(e.target.value)} disabled={busy} />
          )}
          <div style={{ marginTop: 12 }}>
            <Button type="submit" variant="primary" icon="unlock" disabled={busy || !value.trim()} style={{ width: "100%", justifyContent: "center" }}>
              {busy ? "Ontgrendelen…" : "Ontgrendelen"}
            </Button>
          </div>
        </form>

        <button type="button" className="linklike" style={{ marginTop: 14, background: "none", border: "none", color: "var(--blue)", cursor: "pointer", fontSize: 13 }}
          onClick={() => { setMode((m) => (m === "pass" ? "recovery" : "pass")); setValue(""); setErr(null); }}>
          {mode === "pass" ? "Wachtwoord vergeten? Gebruik je herstelcode" : "Terug naar wachtwoord"}
        </button>
      </div>
    </div>
  );
}
