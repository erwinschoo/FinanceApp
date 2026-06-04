import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from "./state/AppContext";
import App from "./App";
import { UnlockGate } from "./components/UnlockGate";
import { initDb, migrateMetaToKeepOnce } from "./db/initDb";
import { keep } from "./db/keep";
import { isEncryptionEnabled } from "./sync/encSession";
import { migrateFromLegacyDb } from "./db/migrateLegacy";
import { seedIfEmpty } from "./db/seed";
import "./pwa/install"; // side-effect: vang 'beforeinstallprompt' vroeg op
import "./styles/app.css";

async function bootstrap() {
  await keep.open();
  // Kies de db-backend (in-memory zodra at-rest actief is: vault + enc-slot aanwezig).
  const { atRest } = await initDb();
  // Apparaat-/sync-/account-meta (incl. enc-slots) eenmalig naar de keep-store verhuizen.
  await migrateMetaToKeepOnce();

  const root = createRoot(document.getElementById("root")!);

  // Heeft deze gebruiker versleuteling ingesteld? → altijd een verplichte unlock-popup
  // bij start. (Zo niet: gewoon doorgaan, geen popup.)
  const encConfigured = await isEncryptionEnabled();
  if (encConfigured) {
    // Verplicht ontgrendelen vóór de app mount. De gate vult/ontsleutelt de data:
    // at-rest → hydrate uit de vault; legacy (nog plaintext) → migreer naar de vault.
    await new Promise<void>((resolve) => {
      root.render(<StrictMode><UnlockGate atRest={atRest} onUnlocked={resolve} /></StrictMode>);
    });
  } else {
    await migrateFromLegacyDb();
    await seedIfEmpty();
  }

  root.render(
    <StrictMode>
      <AppProvider>
        <App />
      </AppProvider>
    </StrictMode>,
  );
}

void bootstrap();
