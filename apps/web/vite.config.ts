import { cpSync, existsSync } from 'node:fs'
import { defineConfig, loadEnv, type Plugin } from 'vite'
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

// Excalidraw fetches its canvas fonts at runtime, from esm.sh unless
// window.EXCALIDRAW_ASSET_PATH points elsewhere. Copy them into public/ (git
// ignores them) so the app serves them itself and nothing leaves the network.
function excalidrawFonts(): Plugin {
  const from = 'node_modules/@excalidraw/excalidraw/dist/prod/fonts'
  const to = 'public/excalidraw/fonts'
  return {
    name: 'doit:excalidraw-fonts',
    configResolved() {
      if (!existsSync(to)) cpSync(from, to, { recursive: true })
    },
  }
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // A different port is a different origin: no saved session, so a new sign-in.
  server: { port: 5310, strictPort: true },
  plugins: [
    excalidrawFonts(),
    devtools(),
    // Start must come before react(). It also breaks Vitest's resolution, so
    // tests run without it.
    ...(process.env.VITEST ? [] : [tanstackStart(), nitro()]),
    viteReact(),
    tailwindcss(),
  ],
})
