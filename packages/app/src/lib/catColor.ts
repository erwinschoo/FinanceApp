/* Centrale, thema-adaptieve achtergrond afgeleid van een categoriekleur.
 *
 * Door de kleur met `transparent` te mixen schemert de onderliggende ondergrond door:
 * licht op een lichte ondergrond (light mode), donker op een donkere (dark mode). Zo
 * hoeft er geen aparte `tint` per categorie te worden opgeslagen en kleuren álle
 * categorie-achtergronden in de hele app consistent met het thema mee. 16% komt overeen
 * met de bestaande --*-soft tokens (rgba … .16).
 *
 * Gebruik dit overal waar een zachte categorie-achtergrond nodig is (tags, avatars,
 * tegels) i.p.v. de opgeslagen Category.tint. */
export const catTint = (color: string) => `color-mix(in srgb, ${color} 16%, transparent)`;
