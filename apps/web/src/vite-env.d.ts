/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  /** Comma list of OAuth sign-in buttons: github, google. */
  readonly VITE_AUTH_PROVIDERS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
