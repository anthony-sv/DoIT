/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  /** Comma list of OAuth sign-in buttons: github, google. */
  readonly VITE_AUTH_PROVIDERS?: string
  /** Self-hosted draw.io, e.g. http://localhost:8080. Default embed.diagrams.net. */
  readonly VITE_DRAWIO_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
