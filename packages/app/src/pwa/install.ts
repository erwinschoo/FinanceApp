import { useSyncExternalStore } from "react";

/* Gedeelde PWA-installatie-state. Het 'beforeinstallprompt'-event (Chromium/
 * Android/Edge) bestaat maar één keer en kan maar één keer gebruikt worden —
 * daarom vangen we het hier op module-niveau en delen we het via een hook met
 * zowel de install-popup, de menuknop als de Download-pagina. iOS/Safari kent
 * dit event niet; daar tonen we handmatige instructies. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const SNOOZE_KEY = "bokkiep:install-snooze";
const SNOOZE_DAYS = 7;

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
export function snoozed(): boolean {
  try {
    const t = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    return Date.now() - t < SNOOZE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}
export function snooze(): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now()));
  } catch {
    /* genegeerd */
  }
}

// Module-state + eenvoudige subscribe/snapshot voor useSyncExternalStore.
let deferred: BeforeInstallPromptEvent | null = null;
let installed = isStandalone();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

window.addEventListener("beforeinstallprompt", (e: Event) => {
  e.preventDefault(); // onderdruk de standaard mini-infobar; wij tonen eigen UI
  deferred = e as BeforeInstallPromptEvent;
  emit();
});
window.addEventListener("appinstalled", () => {
  installed = true;
  deferred = null;
  emit();
});

interface InstallState {
  installed: boolean;
  canInstall: boolean;
  isIos: boolean;
}

// Snapshot wordt gecached zodat useSyncExternalStore een stabiele referentie krijgt.
let snapshot: InstallState = { installed, canInstall: false, isIos: isIos() };
function recompute() {
  const next: InstallState = { installed, canInstall: !!deferred, isIos: isIos() };
  if (next.installed !== snapshot.installed || next.canInstall !== snapshot.canInstall) {
    snapshot = next;
  }
  return snapshot;
}

function subscribe(cb: () => void): () => void {
  const wrapped = () => {
    recompute();
    cb();
  };
  listeners.add(wrapped);
  return () => listeners.delete(wrapped);
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, recompute, recompute);
}

/** Toont de native installatieprompt indien beschikbaar. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  await deferred.prompt();
  const { outcome } = await deferred.userChoice; // 'accepted' → appinstalled volgt
  deferred = null; // event is verbruikt
  emit();
  return outcome;
}
