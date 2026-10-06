/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;

interface ImportMetaEnv {
  readonly VITE_MSAL_CLIENT_ID?: string;
  readonly VITE_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
