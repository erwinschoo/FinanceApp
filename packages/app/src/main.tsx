import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from "./state/AppContext";
import App from "./App";
import { migrateFromLegacyDb } from "./db/migrateLegacy";
import { seedIfEmpty } from "./db/seed";
import "./pwa/install"; // side-effect: vang 'beforeinstallprompt' vroeg op
import "./styles/app.css";

async function bootstrap() {
  await migrateFromLegacyDb();
  await seedIfEmpty();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AppProvider>
        <App />
      </AppProvider>
    </StrictMode>,
  );
}

void bootstrap();
