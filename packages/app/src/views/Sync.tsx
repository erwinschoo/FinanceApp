import { useEffect, useRef, useState } from "react";
import { Ic } from "../components/Ic";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { db } from "../db/schema";
import { keepPut, keepDelete, useKeepMeta, setEncEnabled, clearVault } from "../db/keep";
import { persistVaultNow, verifyVault, exportToPlaintextDb } from "../db/vault";
import { isSyncConfigured, getPca, getAccount, signIn, signOut } from "../sync/msal";
import { syncNow, pushToOneDrive, getSyncMeta, refreshProfilePhoto, exportAll, importAll, fetchRemoteSnapshot, applyPull, isSubstantialTxLoss, fetchCloudBackups, restoreCloudBackup, listLocalBackups, restoreLocalBackup, type Snapshot, type LocalBackup } from "../sync/syncEngine";
import type { BackupItem } from "../sync/graphClient";
import { syncAfterUnlock } from "../sync/autoSync";
import { isEncEnvelope, type EncEnvelope } from "../sync/crypto";
import {
  useEncUnlocked, setupEncryption, unlockWithPassphrase, unlockWithRecovery, unlockWithBiometric,
  enableBiometric, disableBiometric, changePassphrase, lock, isPlatformAuthenticatorAvailable,
  decryptFileWithPassphrase, sealSnapshot,
} from "../sync/encSession";

/* Houdt de verbindingsstatus in db.meta zodat de zijbalk hem reactief kan tonen
 * zonder MSAL te hoeven laden. Bij uitloggen ook de gecachte profielfoto wissen. */
async function setAccountMeta(acc: { email?: string; name?: string } | null) {
  if (acc?.email) await keepPut("account", { email: acc.email, name: acc.name });
  else { await keepDelete("account"); await keepDelete("accountPhoto"); }
}

/* Download de volledige dataset als één bestand naar dit apparaat. Als de sessie
 * ontgrendeld is (encryptie aan), wordt het bestand versleuteld weggeschreven —
 * alleen terug te zetten met de passphrase. Anders platte JSON. */
async function exportToFile(encrypted: boolean) {
  const snap = await exportAll();
  const payload = encrypted ? await sealSnapshot(snap) : snap;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bokkiep-backup-${new Date().toISOString().slice(0, 10)}${encrypted ? "-versleuteld" : ""}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* Lees een eerder geëxporteerd bestand en zet het volledig terug (vervangt lokale
 * data). Herkent zowel platte als versleutelde back-ups; bij een versleuteld
 * bestand vraagt het om de passphrase. */
async function importFromFile(file: File) {
  const parsed = JSON.parse(await file.text()) as unknown;
  let snap: Snapshot;
  if (isEncEnvelope(parsed)) {
    const pass = window.prompt("Dit is een versleutelde back-up. Voer je wachtwoord in om hem terug te zetten:");
    if (pass === null) return; // geannuleerd
    snap = (await decryptFileWithPassphrase(parsed as EncEnvelope, pass)) as Snapshot; // gooit bij fout wachtwoord
  } else {
    snap = parsed as Snapshot;
  }
  if (!snap || typeof snap !== "object" || !Array.isArray(snap.transactions) || !Array.isArray(snap.categories)) {
    throw new Error("Dit lijkt geen geldig bokkiep-back-upbestand.");
  }
  await importAll(snap);
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)",
  background: "var(--surface)", color: "var(--ink)", fontSize: 14, marginTop: 8,
};

/* Beheer van de end-to-end versleuteling: inschakelen (passphrase + herstelcode),
 * ontgrendelen (biometrie/passphrase/herstelcode), biometrie beheren, wachtwoord
 * wijzigen en vergrendelen. Beheert eigen UI-state; meldingen lopen via onMsg. */
function EncryptionCard({ onMsg }: { onMsg: (m: { kind: "ok" | "err"; text: string }) => void }) {
  const unlocked = useEncUnlocked();
  const encRow = useKeepMeta<{ enabled?: boolean }>("enc");
  const devRow = useKeepMeta<unknown>("encDeviceKey");
  const enabled = !!encRow?.enabled;
  const hasBio = !!devRow;
  const [bioAvail, setBioAvail] = useState(false);
  const [mode, setMode] = useState<null | "setup" | "recovery" | "changepass">(null);
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string | null>(null);

  useEffect(() => { void isPlatformAuthenticatorAvailable().then(setBioAvail); }, []);

  function reset() { setMode(null); setP1(""); setP2(""); setErr(null); }
  async function guard(fn: () => Promise<void>) {
    setBusy(true); setErr(null);
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  function validatePair(): boolean {
    if (p1.length < 8) { setErr("Kies een wachtwoord van minstens 8 tekens."); return false; }
    if (p1 !== p2) { setErr("De wachtwoorden komen niet overeen."); return false; }
    return true;
  }

  function doSetup() {
    if (!validatePair()) return;
    void guard(async () => {
      // 1) DEK + slots aanmaken (sessie wordt ontgrendeld). 2) versleutelde vault
      // schrijven en verifiëren dat hij terug-ontsleutelt. 3) pas dán at-rest aanzetten.
      // 4) best-effort directe cloud-kopie. De plaintext-db op schijf wordt bij de
      // eerstvolgende boot opgeruimd (initDb). Reload gebeurt na het tonen van de herstelcode.
      const { recoveryCode } = await setupEncryption(p1);
      await persistVaultNow();
      if (!(await verifyVault())) throw new Error("Kon de versleutelde vault niet verifiëren — niets gewijzigd.");
      await setEncEnabled(true);
      try { await pushToOneDrive(); } catch { /* cloud-kopie is best-effort */ }
      setP1(""); setP2(""); setMode(null);
      setRecovery(recoveryCode);
      onMsg({ kind: "ok", text: "Versleuteling ingeschakeld — al je data wordt nu versleuteld op dit toestel bewaard." });
    });
  }
  /* Uitschakelen: schrijf de ontsleutelde data terug naar een persistente plaintext-db
   * (met verificatie), wis daarna de versleuteling, en herlaad. */
  function doDisable() {
    void guard(async () => {
      if (!confirm("Versleuteling uitschakelen? Je data wordt daarna onversleuteld op dit toestel bewaard (zoals voor het inschakelen). Doorgaan?")) return;
      await exportToPlaintextDb();
      await clearVault();
      await keepDelete("enc");
      await keepDelete("encDeviceKey");
      await setEncEnabled(false);
      location.reload();
    });
  }
  function doUnlock(kind: "pass" | "recovery") {
    void guard(async () => {
      if (kind === "pass") await unlockWithPassphrase(p1);
      else await unlockWithRecovery(p1);
      reset();
      await syncAfterUnlock();
      onMsg({ kind: "ok", text: "Ontgrendeld." });
    });
  }
  function doUnlockBio() {
    void guard(async () => { await unlockWithBiometric(); await syncAfterUnlock(); onMsg({ kind: "ok", text: "Ontgrendeld met biometrie." }); });
  }
  function doChangePass() {
    if (!validatePair()) return;
    void guard(async () => {
      await changePassphrase(p1);
      await pushToOneDrive();
      reset();
      onMsg({ kind: "ok", text: "Wachtwoord gewijzigd." });
    });
  }

  return (
    <div className="card card-pad" style={{ marginTop: 18 }}>
      <div className="card-h" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <Ic name="shield" size={20} style={{ color: enabled && unlocked ? "var(--pos)" : enabled ? "var(--warn)" : "var(--muted)" }} />
        <h3 style={{ margin: 0 }}>Versleuteling</h3>
      </div>

      {err && <div className="notice" style={{ marginBottom: 12, background: "var(--over-soft)", borderColor: "#F3D9D5" }}>
        <span className="ni" style={{ color: "var(--over)" }}><Ic name="info" size={20} /></span><div className="nt">{err}</div>
      </div>}

      {/* Herstelcode tonen (éénmalig, direct na inschakelen) */}
      {recovery ? (
        <>
          <div className="notice" style={{ marginBottom: 12 }}>
            <span className="ni"><Ic name="info" size={20} /></span>
            <div className="nt"><b>Bewaar je herstelcode op een veilige plek.</b> Hiermee kun je je data ontgrendelen als je je wachtwoord vergeet. Zonder wachtwoord én zonder herstelcode is je data <b>niet</b> terug te halen — ook niet door ons of Microsoft. bokkiep wordt na deze stap opnieuw geladen en vraagt je te ontgrendelen.</div>
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 16, letterSpacing: 1, padding: "12px 14px", background: "var(--blue-soft)", borderRadius: 10, color: "var(--ink)", userSelect: "all", wordBreak: "break-all" }}>{recovery}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <Button onClick={() => { void navigator.clipboard?.writeText(recovery); }}>Kopiëren</Button>
            <Button variant="primary" onClick={() => location.reload()}>Ik heb hem opgeslagen</Button>
          </div>
        </>
      ) : !enabled ? (
        /* Nog niet ingeschakeld */
        mode === "setup" ? (
          <>
            <p style={{ color: "var(--body)", fontSize: 14, lineHeight: 1.6, marginTop: 0 }}>
              Kies een sterk wachtwoord. Het blijft op je apparaten en gaat <b>nooit</b> naar Microsoft. Hiermee wordt al je data versleuteld bewaard — zowel op dit toestel als (zero-knowledge) in OneDrive. Bewaar je wachtwoord en herstelcode goed: kwijt = data niet terug te halen.
            </p>
            <input style={inputStyle} type="password" autoComplete="new-password" placeholder="Wachtwoord (min. 8 tekens)" value={p1} onChange={(e) => setP1(e.target.value)} />
            <input style={inputStyle} type="password" autoComplete="new-password" placeholder="Wachtwoord herhalen" value={p2} onChange={(e) => setP2(e.target.value)} />
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <Button variant="primary" icon="lock" disabled={busy} onClick={doSetup}>Inschakelen</Button>
              <Button variant="ghost" disabled={busy} onClick={reset}>Annuleren</Button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: "var(--body)", fontSize: 14, lineHeight: 1.6, marginTop: 0 }}>
              Versleutel <b>al je data</b>: op dit toestel (at-rest) én vóór elke upload naar OneDrive (zero-knowledge — Microsoft ziet alleen onleesbare data). Je ontgrendelt bij elke start met je wachtwoord of — indien beschikbaar — je vingerafdruk/gezicht.
            </p>
            <Button variant="primary" icon="shield" onClick={() => setMode("setup")}>Versleuteling inschakelen</Button>
          </>
        )
      ) : !unlocked ? (
        /* Ingeschakeld maar vergrendeld */
        <>
          <p style={{ color: "var(--body)", fontSize: 14, lineHeight: 1.6, marginTop: 0 }}>
            Je data is versleuteld en op dit toestel <b>vergrendeld</b>. Ontgrendel om te synchroniseren.
          </p>
          {hasBio && (
            <div style={{ marginBottom: 12 }}>
              <Button variant="primary" icon="fingerprint" disabled={busy} onClick={doUnlockBio}>Ontgrendel met biometrie</Button>
            </div>
          )}
          {mode === "recovery" ? (
            <>
              <input style={inputStyle} type="text" placeholder="Herstelcode (XXXX-XXXX-…)" value={p1} onChange={(e) => setP1(e.target.value)} />
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <Button variant="primary" icon="unlock" disabled={busy} onClick={() => doUnlock("recovery")}>Ontgrendelen</Button>
                <Button variant="ghost" disabled={busy} onClick={() => { setMode(null); setP1(""); setErr(null); }}>Terug</Button>
              </div>
            </>
          ) : (
            <>
              <input style={inputStyle} type="password" autoComplete="current-password" placeholder="Wachtwoord" value={p1}
                onChange={(e) => setP1(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doUnlock("pass"); }} />
              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <Button variant="primary" icon="unlock" disabled={busy} onClick={() => doUnlock("pass")}>Ontgrendelen</Button>
                <Button variant="ghost" disabled={busy} onClick={() => { setMode("recovery"); setP1(""); setErr(null); }}>Wachtwoord vergeten?</Button>
              </div>
            </>
          )}
        </>
      ) : (
        /* Ingeschakeld én ontgrendeld */
        mode === "changepass" ? (
          <>
            <input style={inputStyle} type="password" autoComplete="new-password" placeholder="Nieuw wachtwoord (min. 8 tekens)" value={p1} onChange={(e) => setP1(e.target.value)} />
            <input style={inputStyle} type="password" autoComplete="new-password" placeholder="Nieuw wachtwoord herhalen" value={p2} onChange={(e) => setP2(e.target.value)} />
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <Button variant="primary" disabled={busy} onClick={doChangePass}>Opslaan</Button>
              <Button variant="ghost" disabled={busy} onClick={reset}>Annuleren</Button>
            </div>
          </>
        ) : (
          <>
            <div className="notice" style={{ marginBottom: 14, background: "var(--pos-soft)", borderColor: "#CFE6DD" }}>
              <span className="ni" style={{ color: "var(--pos)" }}><Ic name="check" size={20} /></span>
              <div className="nt">Versleuteld en ontgrendeld. Al je data wordt versleuteld bewaard op dit toestel en zero-knowledge versleuteld vóór elke upload naar OneDrive.</div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {hasBio ? (
                <Button icon="fingerprint" disabled={busy} onClick={() => void guard(async () => { await disableBiometric(); onMsg({ kind: "ok", text: "Biometrie uitgeschakeld op dit toestel." }); })}>Biometrie uitschakelen</Button>
              ) : bioAvail ? (
                <Button icon="fingerprint" disabled={busy} onClick={() => void guard(async () => { await enableBiometric(); onMsg({ kind: "ok", text: "Biometrie ingeschakeld op dit toestel." }); })}>Biometrie inschakelen</Button>
              ) : null}
              <Button icon="edit" disabled={busy} onClick={() => { setMode("changepass"); setP1(""); setP2(""); setErr(null); }}>Wachtwoord wijzigen</Button>
              <Button variant="ghost" icon="lock" disabled={busy} onClick={() => { lock(); location.reload(); }}>Vergrendelen</Button>
              <Button variant="ghost" disabled={busy} onClick={doDisable}>Versleuteling uitschakelen</Button>
            </div>
          </>
        )
      )}
    </div>
  );
}

/* Herstel-UI: lokale momentopnames (vóór elke pull/herstel gemaakt) en cloud-backups
 * (vóór elke cloud-overwrite gemaakt). Elk terug te zetten naar dit toestel. Air-tight
 * vangnet zodat een verkeerde sync/overschrijving nooit definitief is. */
function BackupsCard({ onMsg }: { onMsg: (m: { kind: "ok" | "err"; text: string }) => void }) {
  const [cloud, setCloud] = useState<BackupItem[] | null>(null);
  const [local, setLocal] = useState<LocalBackup[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    try {
      setLocal(await listLocalBackups());
      try { setCloud(await fetchCloudBackups()); } catch { setCloud([]); } // cloud optioneel/offline
    } finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);

  const fmt = (iso: string) => new Date(iso).toLocaleString("nl-NL");

  async function doRestoreCloud(name: string) {
    if (!confirm("Deze cloud-back-up vervangt je huidige gegevens op dit toestel. Je huidige staat wordt eerst als lokale momentopname bewaard. Daarna kun je met Uploaden de cloud bijwerken. Doorgaan?")) return;
    setBusy(true);
    try {
      await restoreCloudBackup(name);
      onMsg({ kind: "ok", text: "Cloud-back-up teruggezet op dit toestel. Controleer je gegevens en gebruik daarna Uploaden om de cloud bij te werken." });
      await load();
    } catch (e) {
      onMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(false); }
  }

  async function doRestoreLocal(at: string) {
    if (!confirm("Deze lokale momentopname vervangt je huidige gegevens op dit toestel. Je huidige staat wordt eerst als nieuwe momentopname bewaard. Doorgaan?")) return;
    setBusy(true);
    try {
      await restoreLocalBackup(at);
      onMsg({ kind: "ok", text: "Lokale momentopname teruggezet." });
      await load();
    } catch (e) {
      onMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(false); }
  }

  const hasAny = local.length > 0 || (cloud && cloud.length > 0);

  const count = (cloud?.length ?? 0) + local.length;

  return (
    <details className="card card-pad" style={{ marginTop: 18 }}>
      <summary className="prof-summary card-h" style={{ gap: 8 }}>
        <Ic name="clock" size={20} style={{ color: "var(--muted)", flex: "none" }} />
        <h3 style={{ margin: 0 }}>Vorige versies</h3>
        {count > 0 && <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>{count}</span>}
        <Ic name="chevronDown" size={16} style={{ marginLeft: "auto", color: "var(--faint)", flex: "none" }} />
      </summary>
      <p style={{ color: "var(--body)", fontSize: 14, lineHeight: 1.6, margin: "12px 0 14px" }}>
        Vóór elke cloud-overschrijving en elke pull bewaart bokkiep automatisch een kopie. Raakt er ooit data zoek, dan zet je hier een eerdere versie terug.
      </p>

      {!hasAny ? (
        <div className="notice" style={{ marginTop: 4 }}>
          <span className="ni"><Ic name="info" size={20} /></span>
          <div className="nt">{busy ? "Laden…" : "Nog geen eerdere versies. Die ontstaan zodra je gaat synchroniseren."}</div>
        </div>
      ) : (
        <>
          {cloud && cloud.length > 0 && (
            <div style={{ marginBottom: local.length ? 16 : 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>In OneDrive</div>
              {cloud.map((b) => (
                <div key={b.name} className="prof-map-row">
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <Ic name="cloud" size={16} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmt(b.lastModified)} · {Math.max(1, Math.round(b.size / 1024))} kB</span>
                  </span>
                  <Button variant="ghost" disabled={busy} onClick={() => doRestoreCloud(b.name)}>Terugzetten</Button>
                </div>
              ))}
            </div>
          )}
          {local.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>Op dit toestel</div>
              {local.map((b) => (
                <div key={b.at} className="prof-map-row">
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <Ic name="wallet" size={16} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmt(b.at)} · {b.txCount} transactie{b.txCount === 1 ? "" : "s"}</span>
                  </span>
                  <Button variant="ghost" disabled={busy} onClick={() => doRestoreLocal(b.at)}>Terugzetten</Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </details>
  );
}

/* Stappenplan-breadcrumbs: laat zien hoe ver de gebruiker is richting een volledig beveiligde opzet —
 * verbinden → back-up in de cloud → versleuteld. De actieve stap is de eerste die nog niet klaar is. */
function SyncSteps({ connected, hasCloudFile, encrypted }: { connected: boolean; hasCloudFile: boolean; encrypted: boolean }) {
  const done = [connected, hasCloudFile, encrypted];
  const activeIdx = done.findIndex((d) => !d); // -1 = alles klaar
  const steps = [
    { icon: "onedrive", title: "Verbinden", sub: "met OneDrive" },
    { icon: "clock", title: "Back-up", sub: "in de cloud" },
    { icon: "lock", title: "Versleutelen", sub: "zero-knowledge" },
  ];
  const caption =
    !connected ? "Volgende stap: verbind met OneDrive."
    : !hasCloudFile ? "Volgende stap: maak een back-up met Sync nu."
    : !encrypted ? "Volgende stap: schakel versleuteling in voor een volledig beveiligde opzet."
    : "Je opzet is volledig beveiligd — verbonden, geback-upt én versleuteld.";
  const allDone = activeIdx === -1;

  return (
    <div className="card card-pad sync-steps">
      <div className="sync-steps-row">
        {steps.map((s, i) => {
          const state = done[i] ? "done" : i === activeIdx ? "active" : "todo";
          return (
            <div className="sync-step" key={s.title}>
              {i > 0 && <span className={"sync-step-line" + (done[i - 1] ? " filled" : "")} />}
              <span className={"sync-step-dot " + state}>
                <Ic name={done[i] ? "check" : s.icon} size={18} />
              </span>
              <span className="sync-step-title">{s.title}</span>
              <span className="sync-step-sub">{s.sub}</span>
            </div>
          );
        })}
      </div>
      <div className={"sync-steps-cap" + (allDone ? " ok" : "")}>
        {allDone && <Ic name="check" size={15} />}
        <span>{caption}</span>
      </div>
    </div>
  );
}

export function Sync() {
  const configured = isSyncConfigured();
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string; detail?: string } | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  // Na een conflict ("Sync nu" kan niet veilig kiezen) blokkeren we de knop tot de
  // gebruiker bewust Uploaden of Ophalen heeft gekozen — voorkomt blind doorklikken.
  const [conflict, setConflict] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPlainExport, setShowPlainExport] = useState(false);
  const unlocked = useEncUnlocked();
  const encRow = useKeepMeta<{ enabled?: boolean }>("enc");
  const encEnabled = !!encRow?.enabled;

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

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset zodat hetzelfde bestand opnieuw gekozen kan worden
    if (!file) return;
    let warn = "Hiermee worden al je huidige gegevens vervangen door de inhoud van dit bestand. Doorgaan?";
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      // Versleuteld bestand: inhoud is niet te peilen zonder wachtwoord → generieke waarschuwing.
      if (!isEncEnvelope(parsed)) {
        const snap = parsed as Snapshot;
        const incomingTx = Array.isArray(snap?.transactions) ? snap.transactions.length : 0;
        const currentTx = await db.transactions.count();
        if (isSubstantialTxLoss(currentTx, incomingTx)) {
          warn = `Let op: je vervangt ${currentTx} transacties door ${incomingTx} — je verliest er mogelijk ${currentTx - incomingTx}. Maak eventueel eerst een export. Toch doorgaan?`;
        }
      }
    } catch { /* ongeldige JSON: importFromFile geeft straks een nette foutmelding */ }
    if (!confirm(warn)) return;
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
        setConflict(true);
        setMsg({ kind: "err", text: "De cloud en dit toestel verschillen te veel om automatisch te kiezen — om geen data te verliezen doet de sync niets. Kies bewust: Uploaden (dit toestel → cloud) of Ophalen (cloud → dit toestel)." });
      } else if (r.action === "locked") {
        setMsg({ kind: "err", text: "Je cloud-data is versleuteld. Ontgrendel eerst hieronder met je wachtwoord of biometrie om te kunnen synchroniseren." });
      } else if (r.action === "noop") {
        setMsg({ kind: "ok", text: "Niets te synchroniseren: dit toestel heeft nog geen gegevens. Importeer eerst je transacties." });
      } else {
        const when = r.remoteModified ? new Date(r.remoteModified).toLocaleString("nl-NL") : "";
        const tx = `${r.localTx} transactie${r.localTx === 1 ? "" : "s"}`;
        const detail = r.action === "pulled"
          ? `OneDrive → dit toestel · nieuwere versie van een ander apparaat opgehaald · ${tx}.`
          : `Dit toestel → OneDrive · ${tx}${when ? ` · OneDrive-versie bijgewerkt ${when}` : ""}.`;
        setMsg({ kind: "ok", text: "Data is gesynchroniseerd met OneDrive.", detail });
      }
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  // Ophalen met veiligheidscheck: zou de cloud-versie substantieel minder transacties
  // bevatten, dan eerst expliciet bevestigen (je vervangt immers je lokale data).
  async function pullClick() {
    setBusy(true); setMsg(null);
    try {
      const rs = await fetchRemoteSnapshot();
      if (!rs) throw new Error("Geen databestand in OneDrive gevonden.");
      if (isSubstantialTxLoss(rs.localTx, rs.remoteTx) &&
          !confirm(`Let op: de OneDrive-versie bevat ${rs.remoteTx} transacties, dit toestel ${rs.localTx}. Ophalen vervangt je lokale data; je verliest mogelijk ${rs.localTx - rs.remoteTx} transactie(s). Doorgaan?`)) {
        setBusy(false); return;
      }
      await applyPull(rs.snap, rs.remoteEtag);
      setConflict(false); // bewust opgelost → "Sync nu" weer vrijgeven
      const meta = await getSyncMeta();
      setLastSynced(meta?.lastSyncedAt ?? null);
      setMsg({ kind: "ok", text: "Opgehaald uit OneDrive." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  // Uploaden met veiligheidscheck: zou de cloud (die je overschrijft) substantieel
  // meer transacties bevatten dan dit toestel, dan eerst expliciet bevestigen.
  async function uploadClick() {
    setBusy(true); setMsg(null);
    try {
      const rs = await fetchRemoteSnapshot(); // null = nog geen cloudbestand → niets te verliezen
      if (rs && isSubstantialTxLoss(rs.remoteTx, rs.localTx) &&
          !confirm(`Let op: OneDrive bevat ${rs.remoteTx} transacties, dit toestel ${rs.localTx}. Uploaden overschrijft de cloud; daar verdwijnen mogelijk ${rs.remoteTx - rs.localTx} transactie(s). Doorgaan?`)) {
        setBusy(false); return;
      }
      // Bewuste upload: schrijf met de net-gelezen eTag (dekt een race tussen lezen
      // en schrijven, maar overschrijft wél de huidige cloud zoals de gebruiker wil).
      await pushToOneDrive({ expectedEtag: rs?.remoteEtag });
      setConflict(false); // bewust opgelost → "Sync nu" weer vrijgeven
      const meta = await getSyncMeta();
      setLastSynced(meta?.lastSyncedAt ?? null);
      setMsg({ kind: "ok", text: "Geüpload naar OneDrive." });
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
          <div className="nt">
            {msg.text}
            {msg.detail && <div style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 4 }}>{msg.detail}</div>}
          </div>
        </div>
      )}

      {configured && <SyncSteps connected={!!email} hasCloudFile={!!lastSynced} encrypted={encEnabled} />}

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
          <div className="card-h" style={{ marginBottom: lastSynced ? 4 : 14 }}>
            <h3>Synchroniseren met OneDrive</h3>
          </div>
          {lastSynced && (
            <p style={{ color: "var(--muted)", margin: "0 0 14px", fontSize: 13 }}>
              Laatst gesynct: {new Date(lastSynced).toLocaleString("nl-NL")}
            </p>
          )}

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
                <Button variant="primary" icon="cloud" disabled={busy || conflict} onClick={syncNowClick}>
                  Sync nu
                </Button>
                <Button icon="upload" disabled={busy} onClick={uploadClick}>Uploaden</Button>
                <Button icon="arrowDown" disabled={busy} onClick={pullClick}>Ophalen</Button>
              </div>
              <div className="notice" style={{ marginTop: 18 }}>
                <span className="ni"><Ic name="info" size={20} /></span>
                <div className="nt">{conflict
                  ? <><b>Sync nu</b> is even uitgeschakeld: de cloud en dit toestel verschillen te veel. Kies bewust <b>Uploaden</b> (dit toestel → cloud) of <b>Ophalen</b> (cloud → dit toestel); daarna werkt <b>Sync nu</b> weer.</>
                  : <><b>Sync nu</b> kiest automatisch: is de OneDrive-versie nieuwer (ander apparaat), dan haalt hij op; anders uploadt hij. Bij twijfel gebruik je <b>Uploaden</b>/<b>Ophalen</b> bewust.</>}</div>
              </div>
            </>
          ) : (
            <Button variant="primary" icon="cloud" disabled={busy} onClick={() => run(async () => { const acc = await signIn(); setEmail(acc.username); await setAccountMeta({ email: acc.username, name: acc.name }); await refreshProfilePhoto(); }, "Ingelogd.")}>
              Inloggen met Microsoft
            </Button>
          )}
        </div>
      )}

      {configured && email && <EncryptionCard onMsg={setMsg} />}

      {configured && email && <BackupsCard onMsg={setMsg} />}

      <div className="card card-pad" style={{ marginTop: 18 }}>
        <div className="card-h" style={{ marginBottom: 14 }}><h3>Lokale back-up</h3></div>
        <p style={{ color: "var(--body)", fontSize: 14, lineHeight: 1.6, marginTop: 0 }}>
          Exporteer al je gegevens naar één bestand op dit apparaat, of zet een eerder geëxporteerd bestand terug. Werkt los van OneDrive.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button icon="download" disabled={busy || (encEnabled && !unlocked)}
            onClick={() => run(() => exportToFile(encEnabled && unlocked), (encEnabled && unlocked) ? "Versleutelde back-up gedownload." : "Back-up gedownload.")}>
            {encEnabled && unlocked ? "Exporteren (versleuteld)" : "Exporteren naar bestand"}
          </Button>
          {encEnabled && (
            <Button icon="download" disabled={busy || !unlocked} onClick={() => setShowPlainExport(true)}>
              Exporteren (onversleuteld)
            </Button>
          )}
          <Button icon="upload" disabled={busy} onClick={() => fileInputRef.current?.click()}>Importeren uit bestand</Button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={onFilePicked} />
        </div>
        <div className="notice" style={{ marginTop: 18 }}>
          <span className="ni"><Ic name="info" size={20} /></span>
          <div className="nt">
            <b>Importeren</b> vervangt al je huidige gegevens door de inhoud van het bestand. Maak eventueel eerst een export.
            {encEnabled && (unlocked
              ? " Je export wordt versleuteld met je wachtwoord."
              : " Ontgrendel hierboven om een versleutelde export te maken.")}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showPlainExport}
        title="Onversleutelde back-up maken?"
        message="Dit bestand is niet beveiligd: iedereen die het bestand heeft kan al je gegevens lezen. Gebruik het alleen als bewuste back-up en bewaar het op een veilige plek waar niemand anders bij kan."
        confirmLabel="Onversleuteld exporteren"
        icon="download"
        confirmVariant="primary"
        onCancel={() => setShowPlainExport(false)}
        onConfirm={() => { setShowPlainExport(false); void run(() => exportToFile(false), "Onversleutelde back-up gedownload."); }}
      />
    </div>
  );
}
