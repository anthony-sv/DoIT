import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

// The session as of the last auth event. Route guards read it synchronously;
// supabase-js keeps it fresh (token refresh, other tabs).
let session: Session | null = null
const ready = supabase.auth.getSession().then(({ data }) => {
  session = data.session
})

supabase.auth.onAuthStateChange((event, next) => {
  session = next
  // Every collection holds the previous user's rows; a reload is the
  // simplest way to drop all of it.
  if (event === 'SIGNED_OUT') window.location.assign('/login')
})

export async function getSession() {
  await ready
  return session
}

/** The signed-in user's id. Only call it inside authenticated routes. */
export function currentUserId(): string {
  if (!session) throw new Error('Not signed in')
  return session.user.id
}

export function currentUserEmail(): string {
  return session?.user.email ?? ''
}

export function sendSignInCode(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
  })
}

export function verifySignInCode(email: string, token: string) {
  return supabase.auth.verifyOtp({ email, token, type: 'email' })
}

export function signOut() {
  return supabase.auth.signOut()
}
