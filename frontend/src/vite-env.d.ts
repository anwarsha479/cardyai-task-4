/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_CURRENCY: string;
  /** SEED_DEMO_PASSWORD, passed in by vite.config.ts; empty when it is not set. */
  readonly VITE_DEMO_PASSWORD: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
