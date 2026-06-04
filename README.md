# bokkiep

Persoonlijke financiële Progressive Web App: importeer je bankafschriften, categoriseer
transacties, stel budgetten op en volg spaardoelen. **Local-first** (alles lokaal in de
browser) met optionele **sync naar je eigen OneDrive**.

De code staat bewust open zodat iedereen zelf kan controleren hoe er met je gegevens wordt
omgegaan.

Documentatie, installatie en architectuur: zie [`packages/app/README.md`](packages/app/README.md).

## Licentie & gebruik

bokkiep is **source-available, niet-commercieel**, onder de
[PolyForm Noncommercial License 1.0.0](LICENSE). Je mag de code vrij inzien, auditen,
aanpassen en zelf privé (niet-commercieel) draaien. Commercieel gebruik door derden is
niet toegestaan.

## Encryptie

Versleuteling is **optioneel** en standaard uit. Zonder versleuteling staat je data
gewoon leesbaar lokaal in de browser (en optioneel in jóuw OneDrive) — toegankelijk voor
iedereen met toegang tot dat apparaat of die OneDrive. Zet je versleuteling **aan**, dan
geldt:

- **Alles versleuteld, overal.** Zowel de lokale opslag op dit apparaat als het
  sync-bestand in OneDrive worden versleuteld bewaard. Bij elke app-start is ontgrendelen
  verplicht.
- **Zero-knowledge.** Microsoft (en wie verder ook bij de bestanden kan) ziet alleen de
  versleutelde envelope — nooit leesbare data of een sleutel.

### Hoe het werkt

- **Cijfer:** AES-256-GCM voor alle data (snapshot én lokale vault).
- **Envelope-patroon.** Eén willekeurige **Data Encryption Key (DEK)** versleutelt je
  data. Die DEK wordt apart "gewrapt" (nogmaals AES-GCM-versleuteld) door één of meer
  **Key Encryption Keys (KEK)**. Zo kun je met meerdere geheimen dezelfde data
  ontgrendelen zonder de data te dupliceren.
- **Sleutelafleiding (KDF):** PBKDF2 met SHA-256 en 600.000 iteraties, met een verse
  willekeurige salt per slot.
- **Ontgrendelen** kan via drie soorten geheim: je **wachtwoord (passphrase)**, een
  **herstelcode**, of **WebAuthn-PRF-biometrie** (bv. vingerafdruk/gezicht). Elk geheim is
  een apart "slot" dat de DEK opent.

### Veiligheidskeuzes

- **De DEK staat alléén in het geheugen** — nooit in localStorage, sessionStorage of enige
  andere browser-opslag. Een reload betekent daarom opnieuw ontgrendelen; dat is bewust.
- De DEK wordt als **non-extractable** sleutel geïmporteerd: bruikbaar om te en/decrypten,
  maar de rauwe bytes zijn niet meer uit te lezen (beperkt de schade van een eventuele
  XSS terwijl de pagina open is).
- Bij versleuteling-aan draait de hoofddatabase in-memory; de enige persistente kopie op
  schijf is de **versleutelde vault**. Plaintext raakt dus nooit de schijf.

### Belangrijk

Versleuteling is **zelfbeheer**: jij beheert je wachtwoord en herstelcode. Raak je beide
kwijt, dan is je data onherstelbaar verloren — ook de lokale kopie. Er is geen
achterdeur en niemand (ook bokkiep niet) kan je sleutel herstellen.

De relevante code staat in [`packages/app/src/sync/crypto.ts`](packages/app/src/sync/crypto.ts)
en [`packages/app/src/sync/encSession.ts`](packages/app/src/sync/encSession.ts).
