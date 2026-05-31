// Overdracht van een "met bokkiep geopend" bestand (CSV/Excel) naar de import-wizard.
//
// Twee bronnen leveren hier een bestand af:
//  - Android (Web Share Target): de service worker (src/pwa/sw.ts) stasht het bestand in de Cache;
//    bij app-start halen we het hier op.
//  - Desktop (File Handling API): launchQueue levert het bestand bij het openen aan.
//
// De wizard (views/Import.tsx) abonneert zich via onIncomingFile(). Omdat de Android-redirect direct
// op #import landt, kan de wizard mounten vóór het bestand binnen is — daarom een kleine pub/sub:
// een al-wachtend bestand wordt bij abonneren meteen geleverd, een later bestand zodra het er is.

let pending: File | null = null;
let consumer: ((file: File) => void) | null = null;
let started = false;

/** De wizard registreert zich hier. Levert direct een al-wachtend bestand en alle latere bestanden. */
export function onIncomingFile(cb: (file: File) => void): () => void {
  consumer = cb;
  if (pending) {
    const f = pending;
    pending = null;
    cb(f);
  }
  return () => {
    if (consumer === cb) consumer = null;
  };
}

function deliver(file: File): void {
  if (consumer) consumer(file);
  else pending = file; // bewaar tot de wizard zich abonneert
}

// Moet gelijk zijn aan INCOMING_CACHE / INCOMING_FILE_KEY in src/pwa/sw.ts.
const INCOMING_CACHE = "bokkiep-incoming";
const INCOMING_FILE_KEY = "/__bokkiep_incoming_file__";

/** Leest het door de SW gestashte gedeelde bestand (Android-pad). Verbruikt eenmalig (verwijdert na lezen). */
async function consumeSharedFileFromCache(): Promise<File | null> {
  if (typeof caches === "undefined") return null;
  try {
    const cache = await caches.open(INCOMING_CACHE);
    const res = await cache.match(INCOMING_FILE_KEY);
    if (!res) return null;
    const name = decodeURIComponent(res.headers.get("x-filename") || "") || "import.csv";
    const type = res.headers.get("content-type") || "";
    const file = new File([await res.blob()], name, { type });
    await cache.delete(INCOMING_FILE_KEY);
    return file;
  } catch {
    return null;
  }
}

// File Handling API (desktop) — niet in lib.dom, dus minimale eigen types.
interface LaunchParams {
  files?: { getFile(): Promise<File> }[];
}
interface LaunchQueue {
  setConsumer(consumer: (params: LaunchParams) => void): void;
}

/**
 * Initialiseert beide "open met bokkiep"-paden en levert het bestand aan de wizard zodra het binnenkomt;
 * `openImport` brengt de gebruiker naar de import-view (no-op als die al actief is via de #import-deeplink).
 * Draait dankzij de `started`-guard precies één keer — ook onder React StrictMode.
 */
export function initOpenWithHandlers(openImport: () => void): void {
  if (started) return;
  started = true;

  // (a) Android Share Target: heeft de SW een bestand gestasht?
  void consumeSharedFileFromCache().then((file) => {
    if (file) {
      deliver(file);
      openImport();
    }
  });

  // (b) Desktop File Handling API
  const lq = (globalThis as { launchQueue?: LaunchQueue }).launchQueue;
  lq?.setConsumer((params) => {
    void (async () => {
      const handle = params.files?.[0];
      if (!handle) return;
      try {
        const file = await handle.getFile();
        deliver(file);
        openImport();
      } catch {
        // toegang geweigerd of geen bestand
      }
    })();
  });
}
