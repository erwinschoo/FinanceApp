import { useSyncExternalStore } from "react";
import { db } from "../db/schema";

/* Lichte, MSAL-vrije sync-scheduler.
 * - Importeert syncEngine (en daarmee MSAL) PAS dynamisch bij een echte sync,
 *   en alleen als de gebruiker is ingelogd (db.meta "account" aanwezig).
 *   Zo blijft MSAL uit de hoofdbundle voor lokale/uitgelogde gebruikers.
 * - Push na elke datawijziging (gedebouncet); pull-verzoening bij app-start. */

export type SyncStatus = "idle" | "syncing" | "error" | "offline";

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
    const { pushToOneDrive } = await import("./syncEngine");
    await pushToOneDrive();
    setStatus("idle");
  } catch {
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
    await syncNow();
    setStatus("idle");
    void refreshProfilePhoto(); // profielfoto stil op de achtergrond verversen
  } catch {
    setStatus(navigator.onLine ? "error" : "offline");
  } finally {
    inFlight = false;
  }
}

/* Bij herstel van de verbinding openstaande wijzigingen alsnog wegschrijven. */
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    if (dirty || status === "error" || status === "offline") scheduleSync();
  });
}
