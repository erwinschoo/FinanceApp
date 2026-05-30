import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from "./state/AppContext";
import App from "./App";
import { seedIfEmpty } from "./db/seed";
import "./styles/app.css";

async function bootstrap() {
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
