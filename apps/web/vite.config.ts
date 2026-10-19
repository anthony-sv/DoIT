import { defineConfig, loadEnv } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'

// On Vercel the Supabase values come from the project settings and are inlined
// at build time. Without them the deploy would succeed and every page throw.
if (process.env.VERCEL) {
  const env = loadEnv('production', process.cwd(), 'VITE_')
  for (const name of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']) {
    if (!env[name]) throw new Error(`${name} is not set in Vercel → Settings → Environment Variables`)
  }
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // A different port is a different origin: no saved session, so a new sign-in.
  server: { port: 5310, strictPort: true },
  plugins: [
    devtools(),
    // Start must come before react(). It also breaks Vitest's resolution, so
    // tests run without it.
    ...(process.env.VITEST ? [] : [tanstackStart(), nitro()]),
    viteReact(),
    tailwindcss(),
  ],
})
