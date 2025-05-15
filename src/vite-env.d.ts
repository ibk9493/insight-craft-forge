
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_ENABLE_EXPERIMENTAL: string;
  readonly VITE_DETAILED_ERRORS: string;
  readonly VITE_ENABLE_REALTIME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
