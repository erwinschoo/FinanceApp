import { useSyncExternalStore } from "react";
import { db } from "../db/schema";
import { markUserTouched } from "../db/userContent";

/* Lichte, MSAL-vrije sync-scheduler.
 * - Importeert syncEngine (en daarmee MSAL) PAS dynamisch bij een echte sync,
 *   en alleen als de gebruiker is ingelogd (db.meta "account" aanwezig).
 *   Zo blijft MSAL uit de hoofdbundle voor lokale/uitgelogde gebruikers.
 * - Push na elke datawijziging (gedebouncet); pull-verzoening bij app-start. */

export type SyncStatus = "idle" | "syncing" | "error" | "offline" | "locked";

let status: SyncStatus = "idle";
const listeners = new Set<() => void>();

function setStatus(s: SyncStatus) {
  if (s === status) return;
  status = s;
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/* React-hook voor de zijbalk. */
export function useAutoSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, () => status);
}

/* Goedkope gate: is er een ingelogd OneDrive-account? Laadt geen MSAL. */
async function hasAccount(): Promise<boolean> {
  try {
    const acc = await db.meta.get("account");
    return !!(acc?.value as { email?: string } | undefined)?.email;
  } catch {
    return false;
  }
}

const DEBOUNCE_MS = 2500;
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let dirty = false;

/* Plan een achtergrond-push (gedebouncet). Aangeroepen na elke datamutatie. */
export function scheduleSync(): void {
  // Elke datamutatie loopt hierlangs → hét moment om dit toestel als "heeft echte
  // gebruikersdata" te markeren (seeden/pull doen dit niet). Fire-and-forget.
  void markUserTouched();
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, DEBOUNCE_MS);
}

async function flush(): Promise<void> {
  if (!(await hasAccount())) return;
  if (inFlight) { dirty = true; return; }
  inFlight = true;
  dirty = false;
  setStatus("syncing");
  try {
    const { pushToOneDrive, getSyncMeta, RemoteChangedError } = await import("./syncEngine");
    const { hasUserContent } = await import("../db/userContent");
    // Veiligheid: alleen automatisch pushen als dit toestel al een sync-baseline
    // heeft. Zonder baseline (nog nooit verzoend) zou een push de cloud-backup
    // kunnen overschrijven met mogelijk lege/verse data. Sla dan over; zodra de
    // gebruiker bewust heeft ge-upload of opgehaald, pusht een volgende mutatie.
    if (!(await getSyncMeta())) { setStatus("idle"); return; }
    // Extra vangnet: nooit automatisch een leeg/seed-only toestel naar de cloud duwen.
    if (!(await hasUserContent())) { setStatus("idle"); return; }
    try {
      await pushToOneDrive();
    } catch (e) {
      // Cloud is intussen door een ander toestel gewijzigd (If-Match 412). NIET op de
      // achtergrond automatisch pullen — dat zou de zojuist gemaakte lokale wijziging
      // stil kunnen overschrijven. We laten de wijziging veilig lokaal staan, tonen
      // 'error' en stoppen (dirty=false → geen 2,5s-retryloop). De gebruiker lost het
      // bewust op via 'Sync nu' (volledige conflict-afhandeling + back-ups).
      if (e instanceof RemoteChangedError) { dirty = false; setStatus("error"); return; }
      throw e;
    }
    setStatus("idle");
  } catch (e) {
    const { SyncLockedError } = await import("./syncEngine");
    // Vergrendeld: NIET herplannen (zou een 2,5s-busy-loop met token-calls geven).
    // De openstaande wijziging zit veilig lokaal; syncAfterUnlock() pusht zodra de
    // gebruiker ontgrendelt. dirty bewust op false laten.
    if (e instanceof SyncLockedError) { dirty = false; setStatus("locked"); return; }
    setStatus(navigator.onLine ? "error" : "offline");
    dirty = true; // openstaand: opnieuw proberen bij volgende mutatie of 'online'
  } finally {
    inFlight = false;
    if (dirty && navigator.onLine) scheduleSync();
  }
}

let startupDone = false;

/* Eénmalige verzoening bij app-start: haal de nieuwste cloud-versie op als die
 * nieuwer is (syncNow kiest pull/push). Stil; faalt geruisloos. */
export async function runStartupSync(): Promise<void> {
  if (startupDone) return;
  startupDone = true;
  if (!(await hasAccount())) return;
  if (inFlight) return;
  inFlight = true;
  setStatus("syncing");
  try {
    const { syncNow, refreshProfilePhoto } = await import("./syncEngine");
    const r = await syncNow();
    setStatus(r.action === "locked" ? "locked" : "idle");
    void refreshProfilePhoto(); // profielfoto stil op de achtergrond verversen
  } catch {
    setStatus(navigator.onLine ? "error" : "offline");
  } finally {
    inFlight = false;
  }
}

/* Na het ontgrendelen (passphrase/biometrie) de uitgestelde sync alsnog uitvoeren:
 * verzoen met de cloud en schrijf openstaande lokale wijzigingen weg. */
export async function syncAfterUnlock(): Promise<void> {
  if (!(await hasAccount())) return;
  if (inFlight) { dirty = true; return; }
  inFlight = true;
  setStatus("syncing");
  try {
    const { syncNow } = await import("./syncEngine");
    const r = await syncNow();
    setStatus(r.action === "locked" ? "locked" : "idle");
  } catch {
    setStatus(navigator.onLine ? "error" : "offline");
  } finally {
    inFlight = false;
    if (dirty && navigator.onLine) scheduleSync();
  }
}

/* Bij herstel van de verbinding openstaande wijzigingen alsnog wegschrijven. */
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    if (dirty || status === "error" || status === "offline") scheduleSync();
  });
}
