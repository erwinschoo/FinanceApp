/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_MS_CLIENT_ID?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Build-time constanten (zie `define` in vite.config.ts).
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;
declare const __GIT_COMMIT__: string;
declare const __REACT_VERSION__: string;
declare const __VITE_VERSION__: string;
declare const __TS_VERSION__: string;
