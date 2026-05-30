import { useEffect, useState } from "react";
import { Ic } from "../components/Ic";
import { isSyncConfigured, getPca, getAccount, signIn, signOut } from "../sync/msal";
import { syncNow, pushToOneDrive, pullFromOneDrive, getSyncMeta } from "../sync/syncEngine";

export function Sync() {
  const configured = isSyncConfigured();
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    (async () => {
      try {
        await getPca();
        const acc = getAccount();
        setEmail(acc?.username ?? null);
        const meta = await getSyncMeta();
        setLastSynced(meta?.lastSyncedAt ?? null);
      } catch { /* genegeerd */ }
    })();
  }, [configured]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true); setMsg(null);
    try {
      await fn();
      const meta = await getSyncMeta();
      setLastSynced(meta?.lastSyncedAt ?? null);
      setMsg({ kind: "ok", text: ok });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <div className="content-inner fade-in" style={{ maxWidth: 760 }}>
        <div className="card card-pad">
          <div className="card-h" style={{ marginBottom: 10 }}><h3>Synchroniseren met OneDrive</h3></div>
          <p style={{ color: "var(--body)", fontSize: 14, lineHeight: 1.6 }}>
            Sync is nog niet geconfigureerd. Eenmalige setup met je <b>persoonlijke</b> Microsoft-account (los van werk):
          </p>
          <ol style={{ color: "var(--body)", fontSize: 14, lineHeight: 1.7, paddingLeft: 20 }}>
            <li>Ga naar <b>Microsoft Entra admin center → App registrations → New registration</b>.</li>
            <li>Kies <b>"Personal Microsoft accounts only"</b> en platform <b>Single-page application (SPA)</b>.</li>
            <li>Redirect URI: <code>{window.location.origin + import.meta.env.BASE_URL}</code></li>
            <li>API permissions → Microsoft Graph → <b>delegated</b>: <code>Files.ReadWrite.AppFolder</code> en <code>User.Read</code>.</li>
            <li>Kopieer de <b>Application (client) ID</b> in <code>packages/app/.env</code> als <code>VITE_MS_CLIENT_ID=...</code> en herstart de dev-server.</li>
          </ol>
          <div className="notice" style={{ marginTop: 8 }}>
            <span className="ni"><Ic name="info" size={20} /></span>
            <div className="nt">Je data komt in een eigen mapje <b>Apps/FinanceApp</b> in jouw OneDrive. De app krijgt alleen toegang tot dat mapje.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-inner fade-in" style={{ maxWidth: 760 }}>
      {msg && (
        <div className="notice" style={{ marginBottom: 18, background: msg.kind === "ok" ? "var(--pos-soft)" : "var(--over-soft)", borderColor: msg.kind === "ok" ? "#CFE6DD" : "#F3D9D5" }}>
          <span className="ni" style={{ color: msg.kind === "ok" ? "var(--pos)" : "var(--over)" }}><Ic name={msg.kind === "ok" ? "check" : "info"} size={20} /></span>
          <div className="nt">{msg.text}</div>
        </div>
      )}

      <div className="card card-pad">
        <div className="card-h" style={{ marginBottom: 14 }}>
          <h3>Synchroniseren met OneDrive</h3>
          {lastSynced && <span className="hint">Laatst gesynct: {new Date(lastSynced).toLocaleString("nl-NL")}</span>}
        </div>

        {email ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18 }}>
              <span className="mi" style={{ background: "var(--blue-soft)", color: "var(--blue)", width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><Ic name="cloud" size={19} /></span>
              <div>
                <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 14 }}>Verbonden</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{email}</div>
              </div>
              <button className="btn btn-ghost" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => run(async () => { await signOut(); setEmail(null); }, "Uitgelogd.")}>Uitloggen</button>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn-primary" disabled={busy} onClick={() => run(async () => { const r = await syncNow(); setMsg({ kind: "ok", text: r.action === "pulled" ? "Nieuwere versie opgehaald van OneDrive." : "Lokale data geüpload naar OneDrive." }); }, "Gesynchroniseerd.")}>
                <Ic name="cloud" size={16} /> Sync nu
              </button>
              <button className="btn" disabled={busy} onClick={() => run(pushToOneDrive, "Geüpload naar OneDrive.")}><Ic name="upload" size={16} /> Uploaden</button>
              <button className="btn" disabled={busy} onClick={() => run(async () => { const ok = await pullFromOneDrive(); if (!ok) throw new Error("Geen databestand in OneDrive gevonden."); }, "Opgehaald uit OneDrive.")}><Ic name="arrowDown" size={16} /> Ophalen</button>
            </div>
            <div className="notice" style={{ marginTop: 18 }}>
              <span className="ni"><Ic name="info" size={20} /></span>
              <div className="nt"><b>Sync nu</b> kiest automatisch: is de OneDrive-versie nieuwer (ander apparaat), dan haalt hij op; anders uploadt hij. Bij twijfel gebruik je <b>Uploaden</b>/<b>Ophalen</b> bewust.</div>
            </div>
          </>
        ) : (
          <button className="btn btn-primary" disabled={busy} onClick={() => run(async () => { const acc = await signIn(); setEmail(acc.username); }, "Ingelogd.")}>
            <Ic name="cloud" size={16} /> Inloggen met Microsoft
          </button>
        )}
      </div>
    </div>
  );
}
