import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from "./state/AppContext";
import App from "./App";
import { UnlockGate } from "./components/UnlockGate";
import { initDb, migrateMetaToKeepOnce } from "./db/initDb";
import { keep } from "./db/keep";
import { migrateFromLegacyDb } from "./db/migrateLegacy";
import { seedIfEmpty } from "./db/seed";
import "./pwa/install"; // side-effect: vang 'beforeinstallprompt' vroeg op
import "./styles/app.css";

async function bootstrap() {
  await keep.open();
  // Kies de db-backend op basis van de versleutel-stand (in-memory bij at-rest AAN).
  const { encrypted } = await initDb();
  // Apparaat-/sync-/account-meta eenmalig naar de keep-store verhuizen.
  await migrateMetaToKeepOnce();

  const root = createRoot(document.getElementById("root")!);

  if (encrypted) {
    // At-rest: eerst verplicht ontgrendelen + de in-memory db uit de versleutelde
    // vault vullen — vóór de app (en daarmee live-queries/sync) mount.
    await new Promise<void>((resolve) => {
      root.render(<StrictMode><UnlockGate onUnlocked={resolve} /></StrictMode>);
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
