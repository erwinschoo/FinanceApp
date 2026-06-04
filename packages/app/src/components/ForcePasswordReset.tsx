import { useState } from "react";
import { createPortal } from "react-dom";
import { useKeepMeta } from "../db/keep";
import { changePassphrase, clearRecoveryReset } from "../sync/encSession";
import { pushToOneDrive } from "../sync/syncEngine";
import { Ic } from "./Ic";
import { Button } from "./Button";
import { PasswordInput } from "./PasswordInput";

/* Verschijnt nadat de sessie met de HERSTELCODE is ontgrendeld (wachtwoord vergeten): de gebruiker
 * kiest direct een nieuw wachtwoord. Met "Later" stelt men het uit (deze sessie). */
export function ForcePasswordReset({ onClose }: { onClose: () => void }) {
  const acc = useKeepMeta<{ email?: string }>("account");
  const username = acc?.email ?? "bokkiep";
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (p1.length < 8) { setErr("Kies een wachtwoord van minstens 8 tekens."); return; }
    if (p1 !== p2) { setErr("De wachtwoorden komen niet overeen."); return; }
    setBusy(true); setErr(null);
    try {
      await changePassphrase(p1);
      try { await pushToOneDrive(); } catch { /* cloud-bijwerken is best-effort */ }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  function later() {
    clearRecoveryReset();
    onClose();
  }

  return createPortal(
    <div className="modal-overlay" onClick={later}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-modal="true">
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
          <Ic name="lock" size={20} style={{ color: "var(--blue)" }} />
          <h3 style={{ margin: 0 }}>Stel een nieuw wachtwoord in</h3>
        </div>
        <p>
          Je bent ontgrendeld met je herstelcode. Kies nu een nieuw wachtwoord, zodat je de volgende keer
          gewoon weer met je wachtwoord kunt ontgrendelen. Je herstelcode blijft geldig.
        </p>

        {err && (
          <div className="notice" style={{ margin: "0 0 12px", background: "var(--over-soft)", borderColor: "#F3D9D5", textAlign: "left" }}>
            <span className="ni" style={{ color: "var(--over)" }}><Ic name="info" size={20} /></span>
            <div className="nt">{err}</div>
          </div>
        )}

        <input type="text" name="username" autoComplete="username" value={username} readOnly hidden aria-hidden="true" />
        <PasswordInput autoComplete="new-password" placeholder="Nieuw wachtwoord (min. 8 tekens)" value={p1} onChange={setP1} ariaLabel="Nieuw wachtwoord" disabled={busy} autoFocus style={{ marginTop: 0 }} />
        <PasswordInput autoComplete="new-password" placeholder="Nieuw wachtwoord herhalen" value={p2} onChange={setP2} ariaLabel="Nieuw wachtwoord herhalen" disabled={busy} />

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <Button style={{ flex: 1, justifyContent: "center" }} disabled={busy} onClick={later}>Later</Button>
          <Button type="submit" variant="primary" icon="check" style={{ flex: 1, justifyContent: "center" }} disabled={busy}>
            {busy ? "Opslaan…" : "Wachtwoord opslaan"}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
