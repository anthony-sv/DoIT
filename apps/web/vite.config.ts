import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: { port: 5310 },
  plugins: [
    devtools(),
    // Start must come before react(). It also breaks Vitest's resolution, so
    // tests run without it.
    ...(process.env.VITEST ? [] : [tanstackStart(), nitro()]),
    viteReact(),
    tailwindcss(),
  ],
})
