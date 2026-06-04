import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/* Injecteert een Content-Security-Policy als <meta> in de PRODUCTIE-build.
 * GitHub Pages kan geen HTTP-headers zetten, dus de CSP gaat in de HTML zelf.
 * Alleen bij `build` (niet in dev — daar zou het Vite's HMR/inline scripts breken).
 * De hashes van inline <script>-blokken (bv. de thema-bootstrap) worden automatisch
 * berekend, zodat we 'unsafe-inline' voor scripts kunnen vermijden.
 *
 * Doel: een gestolen MSAL-token via XSS kan dan geen data wegsluizen, en samen met
 * de end-to-end encryptie ziet OneDrive sowieso alleen ciphertext. */
function cspPlugin(): Plugin {
  let isBuild = false;
  return {
    name: "bokkiep-csp",
    configResolved(c) { isBuild = c.command === "build"; },
    transformIndexHtml: {
      order: "post",
      handler(html) {
        if (!isBuild) return html;
        const hashes = new Set<string>();
        for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
          if (!m[1]) continue; // leeg of alleen-src script overslaan
          hashes.add(`'sha256-${createHash("sha256").update(m[1], "utf8").digest("base64")}'`);
        }
        const csp = [
          "default-src 'self'",
          `script-src 'self' ${[...hashes].join(" ")}`.trim(),
          "style-src 'self' 'unsafe-inline'", // React inline-styles (style={{…}})
          "img-src 'self' data: blob:", // profielfoto = data-URL
          // graph + login voor de API/auth; de OneDrive-content-hosts zijn nodig omdat een
          // GET op bestandsinhoud (data.json:/content) bij een persoonlijk account 302-redirect
          // naar een aparte download-host (*.microsoftpersonalcontent.com / *.dms.live.com,
          // zakelijk: *.sharepoint.com). Zonder deze hosts → "Failed to fetch" op elke download.
          "connect-src 'self' https://graph.microsoft.com https://login.microsoftonline.com https://*.microsoftpersonalcontent.com https://*.dms.live.com https://*.sharepoint.com",
          "frame-src https://login.microsoftonline.com", // MSAL silent-token iframe
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; ");
        return html.replace("</head>", `  <meta http-equiv="Content-Security-Policy" content="${csp}">\n  </head>`);
      },
    },
  };
}

// GitHub Pages serveert op een subpad: https://<gebruiker>.github.io/bokkiep/
// Pas dit aan als de repo anders heet. Lokaal (dev) gebruikt altijd "/".
const base = process.env.GITHUB_PAGES === "true" ? "/bokkiep/" : "/";

// Build-info voor de App-informatie-tile (Informatie-pagina).
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));
const clean = (v: string) => v.replace(/^[^0-9]*/, "");
function gitCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "—";
  }
}

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __GIT_COMMIT__: JSON.stringify(gitCommit()),
    __REACT_VERSION__: JSON.stringify(clean(pkg.dependencies.react)),
    __VITE_VERSION__: JSON.stringify(clean(pkg.devDependencies.vite)),
    __TS_VERSION__: JSON.stringify(clean(pkg.devDependencies.typescript)),
  },
  plugins: [
    cspPlugin(),
    react(),
    VitePWA({
      // injectManifest i.p.v. generateSW: we beheren de service worker zelf (src/pwa/sw.ts) zodat
      // we de Web Share Target-POST (gedeeld CSV/Excel-bestand) kunnen opvangen. Offline-precache,
      // SPA-fallback en autoUpdate worden in de SW zelf gereproduceerd.
      strategies: "injectManifest",
      srcDir: "src/pwa",
      filename: "sw.ts",
      registerType: "autoUpdate",
      // Registratiecode als EXTERN script (registerSW.js) i.p.v. inline, zodat de
      // CSP 'self' volstaat en we geen inline-script-hash hoeven te beheren.
      injectRegister: "script-defer",
      includeAssets: ["icon.svg", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "bokkiep — persoonlijk financieel overzicht",
        short_name: "bokkiep",
        description: "Importeer banktransacties, categoriseer, budgetteer en volg je spaardoelen.",
        lang: "nl",
        // Bewust ZWART (niet STATUS_BAR.light): de geïnstalleerde PWA kleurt met deze waarde de
        // dunne naad/rand tussen de systeem-statusbalk en de webview. Zwart → zwarte rand onder de
        // blauwe balk in light, en zwart-op-zwart (onzichtbaar) in dark. De zichtbare statusbalk
        // zelf wordt per thema gezet via de runtime <meta theme-color> in useTheme.ts (blauw/zwart).
        theme_color: "#000000",
        // Zwarte PWA-achtergrond: kleurt de naad onder de system-app-bar (en de splash) zwart →
        // zwarte rand onder de blauwe balk in light, onzichtbaar in dark.
        background_color: "#000000",
        display: "standalone",
        start_url: ".",
        scope: ".",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
        // CSV/Excel openen mét bokkiep → direct de import-wizard.
        // Android: de deel-knop (Web Share Target). De service worker (src/pwa/sw.ts) vangt de POST op,
        // stasht het bestand en stuurt door naar #import. De accept-lijst is bewust breed: Android
        // rapporteert het MIME-type van een CSV inconsistent — de SW vertrouwt op de bestandsnaam,
        // niet op het MIME-type, dus een te brede lijst is veilig.
        share_target: {
          action: "share-target",
          method: "POST",
          enctype: "multipart/form-data",
          params: {
            files: [
              {
                name: "sharedFile", // MOET gelijk zijn aan form.get("sharedFile") in src/pwa/sw.ts
                accept: [
                  "text/csv",
                  "text/comma-separated-values",
                  "application/csv",
                  "text/plain",
                  "application/vnd.ms-excel",
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  "application/octet-stream",
                  ".csv",
                  ".xls",
                  ".xlsx",
                ],
              },
            ],
          },
        },
        // Desktop (Edge/Chrome): "Openen met → bokkiep" (File Handling API). De action is base-afgeleid
        // (/ of /bokkiep/) zodat hij binnen de manifest-scope valt op GitHub Pages.
        file_handlers: [
          {
            action: `${base}#import`,
            accept: {
              "text/csv": [".csv"],
              "application/vnd.ms-excel": [".xls", ".csv"],
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
            },
          },
        ],
      },
      injectManifest: {
        // Zelfde set als de oude workbox-config → offline-pariteit.
        globPatterns: ["**/*.{js,css,html,ttf,svg,png,woff2}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // een xlsx-chunk kan groot zijn
      },
      // SW ook in dev actief, zodat de share-target/deeplink lokaal te testen is.
      devOptions: { enabled: true, type: "module", navigateFallback: "index.html" },
    }),
  ],
});
