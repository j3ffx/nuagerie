/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
declare const __ORT_GLUE_URL__: string;
declare const __ORT_WASM_URL__: string;

interface ImportMetaEnv {
  readonly VITE_MSAL_CLIENT_ID?: string;
  readonly VITE_DEMO?: string;
  /** The app's own address, once it has one (src/app/home.ts). */
  readonly VITE_HOME_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
