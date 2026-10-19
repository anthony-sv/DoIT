import { useSyncExternalStore } from 'react'
import { hasPassword, onAuthChange } from '@/lib/auth'

/** Whether the account has a password; flips as soon as one is set, here or in another tab. */
export function useHasPassword() {
  return useSyncExternalStore(onAuthChange, hasPassword, () => false)
}
