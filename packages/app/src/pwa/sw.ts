/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { clientsClaim } from "workbox-core";

// Module-scoped herdeclaratie van `self` als ServiceWorkerGlobalScope (de globale lib-`self` is
// Window door de DOM-lib; skipLibCheck dempt het lib-conflict). `__WB_MANIFEST` wordt bij de build
// vervangen door de precache-lijst — de letterlijke tekst `self.__WB_MANIFEST` moet blijven staan.
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Origin-absolute sleutel (begint met "/") → resolvet identiek in de SW en in de pagina, ongeacht
// de base ("/" of "/bokkiep/"). Moet gelijk zijn aan INCOMING_FILE_KEY in src/import/incoming.ts.
const INCOMING_CACHE = "bokkiep-incoming";
const INCOMING_FILE_KEY = "/__bokkiep_incoming_file__";
const SHARE_PATH = "/share-target";

// Web Share Target (Android): vang de multipart-POST op, stash het bestand in de Cache en stuur door
// naar #import. Bewust als EERSTE fetch-listener geregistreerd (vóór de workbox-routes), zodat deze
// handler de POST afhandelt voordat de NavigationRoute hem zou kunnen opslokken.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || !url.pathname.endsWith(SHARE_PATH)) return;
  event.respondWith(
    (async () => {
      try {
        const form = await event.request.formData();
        const file = form.get("sharedFile"); // MOET matchen met manifest share_target params.files[].name
        if (file instanceof File) {
          const cache = await caches.open(INCOMING_CACHE);
          await cache.put(
            INCOMING_FILE_KEY,
            new Response(file, {
              headers: {
                "content-type": file.type || "application/octet-stream",
                // Bestandsnaam behouden: parseFile() kiest CSV vs Excel op ".csv" in de naam, dus dit
                // blijft kloppen ook als Android het MIME-type als octet-stream/text-plain doorgeeft.
                "x-filename": encodeURIComponent(file.name || "import.csv"),
              },
            }),
          );
        }
      } catch {
        // negeren: we sturen sowieso door naar de import-view
      }
      // Relatieve redirect → werkt onder zowel "/" (dev) als "/bokkiep/" (GitHub Pages).
      // ?shared=1 vóór de hash (anders wordt het onderdeel van de hash en herkent de router #import niet).
      const dest = new URL("./?shared=1#import", self.registration.scope);
      return Response.redirect(dest.toString(), 303);
    })(),
  );
});

// Offline-precache (pariteit met de oude generateSW-config).
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA-navigatie: serveer de geprecachte index.html voor navigaties (offline deep-links blijven werken).
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), {
    denylist: [/\/share-target$/, /\/[^/?]+\.[^/]+$/],
  }),
);

// autoUpdate-pariteit: neem direct de controle over zodra de nieuwe SW activeert.
self.skipWaiting();
clientsClaim();
