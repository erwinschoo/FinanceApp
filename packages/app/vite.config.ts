import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serveert op een subpad: https://<gebruiker>.github.io/bokkiep/
// Pas dit aan als de repo anders heet. Lokaal (dev) gebruikt altijd "/".
const base = process.env.GITHUB_PAGES === "true" ? "/bokkiep/" : "/";

export default defineConfig({
  base,
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
        theme_color: "#FEFBF6",
        background_color: "#F7F8FA",
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
