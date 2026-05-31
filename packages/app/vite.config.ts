import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

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
    react(),
    VitePWA({
      registerType: "autoUpdate",
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
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ttf,svg,png,woff2}"],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
