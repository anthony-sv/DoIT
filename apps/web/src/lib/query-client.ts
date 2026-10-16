import { QueryClient } from '@tanstack/react-query'

// One client for the whole app: collections and route loaders share it.
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
})
