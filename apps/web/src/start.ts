import { createStart } from '@tanstack/react-start'

// TanStack DB collections are client-only, so nothing renders on the server.
export const startInstance = createStart(() => ({
  defaultSsr: false,
}))
