# bokkiep

Persoonlijke financiële Progressive Web App: importeer ING-transacties via Excel/CSV, categoriseer ze, stel budgetten per categorie op en volg meerdere spaardoelen. **Local-first** (alles lokaal in de browser via IndexedDB) met optionele **sync naar je eigen OneDrive** via Microsoft Graph.

## Tech

Vite · React 18 · TypeScript · Dexie (IndexedDB) · SheetJS (xlsx) · MSAL (Microsoft Graph) · vite-plugin-pwa. Eigen CSS-designsysteem en handgebouwde SVG-grafieken (geport uit `../design`).

## Lokaal draaien

```bash
cd packages/app
npm install
npm run dev        # http://localhost:5173
```

Bij de eerste start wordt de database gevuld met alleen **functionele referentie-structuur** (categorieën, groepen, categorisatie-regels, ING-importprofiel) — bewust **geen** verzonnen cijfers (geen budgetbedragen, geen startsaldo, geen demo-transacties). Een verse install start dus leeg: het dashboard toont een banner die naar **Importeren** leidt. Verwijder de IndexedDB ("bokkiep") via DevTools → Application om opnieuw te seeden.

Het **beginsaldo** van de betaalrekening stel je in onder **Profiel** (default €0). Het wordt alleen gebruikt zolang de import nog geen banksaldo meelevert; zodra dat er is, heeft het echte banksaldo voorrang.

```bash
npm run build      # productie-build (typecheck + vite build)
npm run preview     # serveer de build lokaal (PWA installeerbaar testen)
```

## Een eigen bankexport importeren

1. Exporteer je transacties in **Mijn ING** als CSV of Excel.
2. Ga naar **Importeren**, sleep het bestand erin.
3. De app schoont merchant-namen op, categoriseert via regels en slaat duplicaten over.
4. Controleer de preview en klik **Voeg toe aan overzicht**.

In **Transacties** kun je een categorie handmatig aanpassen en met **regel maken** onthouden voor volgende imports.

## OneDrive-sync instellen (optioneel)

Volledig los van een werk-/delaware-account — gebruik een **persoonlijk** Microsoft-account.

1. [Microsoft Entra admin center](https://entra.microsoft.com) → **App registrations → New registration**.
   - Naam: **bokkiep** (bepaalt de mapnaam `Apps/bokkiep` in OneDrive).
   - Supported account types: **Personal Microsoft accounts only**.
   - Platform: **Single-page application (SPA)**.
   - Redirect URI: `http://localhost:5173/` (en later je GitHub Pages-URL, bv. `https://<gebruiker>.github.io/bokkiep/`).
2. **API permissions** → Microsoft Graph → **Delegated**: `Files.ReadWrite.AppFolder` en `User.Read`.
3. Kopieer de **Application (client) ID**.
4. Maak `packages/app/.env` (zie `.env.example`):
   ```
   VITE_MS_CLIENT_ID=<jouw-client-id>
   ```
5. Herstart `npm run dev`. Ga naar **Synchroniseren** → **Inloggen met Microsoft**.

Je data komt in een eigen mapje `Apps/bokkiep/data.json` in jouw OneDrive; de app krijgt alléén toegang tot dat mapje. **Sync nu** kiest automatisch op-/afhalen; met **Uploaden**/**Ophalen** stuur je het bewust.

### Databeveiliging (air-tight)

De sync is opgezet zodat je **nooit stil data kunt verliezen**:

- **Nooit een gevulde cloud overschrijven met een leeg/vers toestel.** Een toestel zonder echte gebruikersdata (alleen seed-structuur) doet bij sync altijd een *pull*, nooit een push. "Echte data" wordt centraal bepaald door `hasUserContent` (`src/db/userContent.ts`).
- **Back-up vóór elke overschrijving.** Vóór een cloud-overwrite wordt de huidige `data.json` gekopieerd naar `Apps/bokkiep/backups/` (laatste 10). Vóór een lokale pull/herstel wordt een lokale momentopname bewaard (laatste 3). Beide terug te zetten onder **Synchroniseren → Vorige versies**.
- **Optimistic concurrency.** Uploads gebruiken `If-Match` op de laatst gelezen eTag; is de cloud intussen door een ander toestel gewijzigd (412), dan wordt er niets overschreven en volgt een conflict.
- **Fail closed.** Netwerkfouten, vergrendelde encryptie of een gewijzigde cloud leiden nooit tot een stille overschrijving — de lokale data blijft staan.

## Hosten op GitHub Pages

1. Zet deze repo op GitHub. In **Settings → Pages**: Source = **GitHub Actions**.
2. De workflow [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) bouwt en publiceert automatisch bij elke push naar `main`.
3. Voor sync in productie: zet de client-ID als repository-**variable** `MS_CLIENT_ID` (Settings → Secrets and variables → Actions → Variables), en voeg de Pages-URL toe als redirect URI in de app-registratie.

> De build gebruikt `base: "/bokkiep/"` (zie `vite.config.ts`). Heet je repo anders, pas dat pad dan aan.

## Structuur

```
src/
  db/         Dexie-schema, types, seed, mappers (centen↔euro), repo (mutaties)
  state/      AppContext (live queries naar Dexie)
  import/     SheetJS-parser, ING-profiel, merchant-opschoning, dedupe
  categorize/ regels-engine + standaardregels
  helpers/    aggregaties (per maand/categorie) + budgetkleur-schaal
  goals/      spaardoel-berekeningen
  sync/       MSAL-auth, Graph-client, sync-engine
  charts/ components/ views/   geporte UI
```
