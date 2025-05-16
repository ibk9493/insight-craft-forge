
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_ENABLE_EXPERIMENTAL: string;
  readonly VITE_DETAILED_ERRORS: string;
  readonly VITE_ENABLE_REALTIME: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_API_KEY: string;
  readonly VITE_USE_MOCK_DATA: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
