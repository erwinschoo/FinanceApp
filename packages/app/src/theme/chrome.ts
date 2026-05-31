/* Eén bron van waarheid voor de PWA-/browser-chrome-kleur (de systeem-statusbalk bovenaan).
 * useTheme.ts gebruikt dit om <meta name="theme-color"> per thema te zetten.
 *
 * LET OP — mirror: de runtime-statusbalk-kleur staat ook (statisch) in index.html, dat vóór de
 * bundle draait. Houd die gelijk aan onderstaande waarden:
 *   - index.html → <meta name="theme-color"> (= light) + inline dark-script (= dark)
 *
 * NB: de manifest `theme_color` in vite.config.ts is BEWUST zwart (niet STATUS_BAR.light). Dat is
 * geen mirror: de geïnstalleerde PWA kleurt met die manifest-waarde de naad onder de statusbalk,
 * en zwart geeft een zwarte rand onder de blauwe balk in light (en niets in dark). De zichtbare
 * statusbalk wordt per thema gezet via onderstaande STATUS_BAR + de runtime <meta>.
 *
 * De onderste navigatiebalk is (nog) niet via de PWA te kleuren; dat volgt het systeemthema.
 */
export const STATUS_BAR = { light: "#5E81B5", dark: "#000000" } as const;
