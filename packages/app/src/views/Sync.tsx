import { useEffect, useRef, useState } from "react";
import { Ic } from "../components/Ic";
import { Button } from "../components/Button";
import { db } from "../db/schema";
import { isSyncConfigured, getPca, getAccount, signIn, signOut } from "../sync/msal";
import { syncNow, pushToOneDrive, pullFromOneDrive, getSyncMeta, refreshProfilePhoto, exportAll, importAll, type Snapshot } from "../sync/syncEngine";

/* Houdt de verbindingsstatus in db.meta zodat de zijbalk hem reactief kan tonen
 * zonder MSAL te hoeven laden. Bij uitloggen ook de gecachte profielfoto wissen. */
async function setAccountMeta(acc: { email?: string; name?: string } | null) {
  if (acc?.email) await db.meta.put({ key: "account", value: { email: acc.email, name: acc.name } });
  else { await db.meta.delete("account"); await db.meta.delete("accountPhoto"); }
}

/* Download de volledige dataset als één JSON-bestand naar dit apparaat. */
async function exportToFile() {
  const snap = await exportAll();
  const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bokkiep-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* Lees een eerder geëxporteerd bestand en zet het volledig terug (vervangt lokale data). */
async function importFromFile(file: File) {
  const snap = JSON.parse(await file.text()) as Snapshot;
  if (!snap || typeof snap !== "object" || !Array.isArray(snap.transactions) || !Array.isArray(snap.categories)) {
    throw new Error("Dit lijkt geen geldig bokkiep-back-upbestand.");
  }
  await importAll(snap);
}

export function Sync() {
  const configured = isSyncConfigured();
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!configured) return;
    (async () => {
      try {
        await getPca();
        const acc = getAccount();
        setEmail(acc?.username ?? null);
        await setAccountMeta(acc ? { email: acc.username, name: acc.name } : null);
        if (acc) void refreshProfilePhoto(); // bestaande gebruikers: foto alsnog ophalen
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

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset zodat hetzelfde bestand opnieuw gekozen kan worden
    if (!file) return;
    if (!confirm("Hiermee worden al je huidige gegevens vervangen door de inhoud van dit bestand. Doorgaan?")) return;
    void run(() => importFromFile(file), "Back-up teruggezet.");
  }

  // "Sync nu" verwerkt expliciet de drie uitkomsten. Bij een conflict (dit toestel
  // is nog nooit verzoend én er staat al data in de cloud) doet de sync bewust niets
  // en vragen we de gebruiker zelf te kiezen — zo wordt nooit stil data overschreven.
  async function syncNowClick() {
    setBusy(true); setMsg(null);
    try {
      const r = await syncNow();
      const meta = await getSyncMeta();
      setLastSynced(meta?.lastSyncedAt ?? null);
      if (r.action === "conflict") {
        setMsg({ kind: "err", text: "Dit toestel is nog niet verzoend met OneDrive en beide kanten hebben data. Kies bewust: Uploaden (dit toestel → cloud) of Ophalen (cloud → dit toestel)." });
      } else {
        setMsg({ kind: "ok", text: r.action === "pulled" ? "Nieuwere versie opgehaald van OneDrive." : "Lokale data geüpload naar OneDrive." });
      }
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="content-inner fade-in" style={{ maxWidth: 760 }}>
      {msg && (
        <div className="notice sync-msg" role="status" onClick={() => setMsg(null)} title="Verbergen"
          style={{ marginBottom: 18, cursor: "pointer", background: msg.kind === "ok" ? "var(--pos-soft)" : "var(--over-soft)", borderColor: msg.kind === "ok" ? "#CFE6DD" : "#F3D9D5" }}>
          <span className="ni" style={{ color: msg.kind === "ok" ? "var(--pos)" : "var(--over)" }}><Ic name={msg.kind === "ok" ? "check" : "info"} size={20} /></span>
          <div className="nt">{msg.text}</div>
        </div>
      )}

      {!configured ? (
        <div className="card card-pad">
          <div className="card-h" style={{ marginBottom: 10 }}><h3>Synchroniseren met OneDrive</h3></div>
          <p style={{ color: "var(--body)", fontSize: 14, lineHeight: 1.6 }}>
            Sync is nog niet geconfigureerd. Eenmalige setup met je <b>persoonlijke</b> Microsoft-account (los van werk):
          </p>
          <ol style={{ color: "var(--body)", fontSize: 14, lineHeight: 1.7, paddingLeft: 20 }}>
            <li>Ga naar <b>Microsoft Entra admin center → App registrations → New registration</b>. Geef de registratie de naam <b>bokkiep</b> — zo heet straks ook je OneDrive-mapje <code>Apps/bokkiep</code>.</li>
            <li>Kies <b>"Personal Microsoft accounts only"</b> en platform <b>Single-page application (SPA)</b>.</li>
            <li>Redirect URI: <code>{window.location.origin + import.meta.env.BASE_URL}</code></li>
            <li>API permissions → Microsoft Graph → <b>delegated</b>: <code>Files.ReadWrite.AppFolder</code> en <code>User.Read</code>.</li>
            <li>Kopieer de <b>Application (client) ID</b> in <code>packages/app/.env</code> als <code>VITE_MS_CLIENT_ID=...</code> en herstart de dev-server.</li>
          </ol>
          <div className="notice" style={{ marginTop: 8 }}>
            <span className="ni"><Ic name="info" size={20} /></span>
            <div className="nt">Je data komt in een eigen mapje <b>Apps/bokkiep</b> in jouw OneDrive. De app krijgt alleen toegang tot dat mapje.</div>
          </div>
        </div>
      ) : (
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
                <Button variant="ghost" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => run(async () => { await signOut(); setEmail(null); await setAccountMeta(null); }, "Uitgelogd.")}>Uitloggen</Button>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button variant="primary" icon="cloud" disabled={busy} onClick={syncNowClick}>
                  Sync nu
                </Button>
                <Button icon="upload" disabled={busy} onClick={() => run(pushToOneDrive, "Geüpload naar OneDrive.")}>Uploaden</Button>
                <Button icon="arrowDown" disabled={busy} onClick={() => run(async () => { const ok = await pullFromOneDrive(); if (!ok) throw new Error("Geen databestand in OneDrive gevonden."); }, "Opgehaald uit OneDrive.")}>Ophalen</Button>
              </div>
              <div className="notice" style={{ marginTop: 18 }}>
                <span className="ni"><Ic name="info" size={20} /></span>
                <div className="nt"><b>Sync nu</b> kiest automatisch: is de OneDrive-versie nieuwer (ander apparaat), dan haalt hij op; anders uploadt hij. Bij twijfel gebruik je <b>Uploaden</b>/<b>Ophalen</b> bewust.</div>
              </div>
            </>
          ) : (
            <Button variant="primary" icon="cloud" disabled={busy} onClick={() => run(async () => { const acc = await signIn(); setEmail(acc.username); await setAccountMeta({ email: acc.username, name: acc.name }); await refreshProfilePhoto(); }, "Ingelogd.")}>
              Inloggen met Microsoft
            </Button>
          )}
        </div>
      )}

      <div className="card card-pad" style={{ marginTop: 18 }}>
        <div className="card-h" style={{ marginBottom: 14 }}><h3>Lokale back-up</h3></div>
        <p style={{ color: "var(--body)", fontSize: 14, lineHeight: 1.6, marginTop: 0 }}>
          Exporteer al je gegevens naar één bestand op dit apparaat, of zet een eerder geëxporteerd bestand terug. Werkt los van OneDrive.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button icon="download" disabled={busy} onClick={() => run(exportToFile, "Back-up gedownload.")}>Exporteren naar bestand</Button>
          <Button icon="upload" disabled={busy} onClick={() => fileInputRef.current?.click()}>Importeren uit bestand</Button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={onFilePicked} />
        </div>
        <div className="notice" style={{ marginTop: 18 }}>
          <span className="ni"><Ic name="info" size={20} /></span>
          <div className="nt"><b>Importeren</b> vervangt al je huidige gegevens door de inhoud van het bestand. Maak eventueel eerst een export.</div>
        </div>
      </div>
    </div>
  );
}
