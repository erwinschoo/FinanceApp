/* Eén bron van waarheid voor de PWA-/browser-chrome-kleur (de systeem-statusbalk bovenaan).
 * useTheme.ts gebruikt dit om <meta name="theme-color"> per thema te zetten.
 *
 * LET OP — mirrors: dezelfde waarden staan ook (statisch) op plekken die NIET kunnen importeren
 * omdat ze vóór de bundle of op build-time draaien. Houd die gelijk aan onderstaande waarden:
 *   - index.html      → <meta name="theme-color"> (= light) + inline dark-script (= dark)
 *   - vite.config.ts  → manifest.theme_color (= light; een manifest kent maar één waarde,
 *                       Android gebruikt deze bij het opstarten van de geïnstalleerde PWA)
 *
 * De onderste navigatiebalk wordt NIET via theme-color gekleurd maar via de `.safe-bottom`-scrim
 * in app.css (altijd zwart). De randen/achtergronden binnen de app komen uit de CSS-tokens.
 */
export const STATUS_BAR = { light: "#5E81B5", dark: "#000000" } as const;
