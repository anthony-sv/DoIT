import {
  type Session,
  isAuthError,
  isAuthImplicitGrantRedirectError,
  isAuthRetryableFetchError,
  isAuthWeakPasswordError,
} from '@supabase/supabase-js'
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

/** Whether the account has a password, as far as the app knows (see changePassword). */
export function hasPassword(): boolean {
  return session?.user.user_metadata.has_password === true
}

/**
 * Calls `listener` after every auth event (sign-in, token refresh, profile
 * update, other tabs). `session` above is already up to date by then: its
 * listener was registered first.
 */
export function onAuthChange(listener: () => void) {
  const { data } = supabase.auth.onAuthStateChange(() => listener())
  return () => data.subscription.unsubscribe()
}

export function sendSignInCode(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    // Supabase's "Allow new users to sign up" setting decides whether an
    // unknown email gets an account, so that stays the only switch.
    options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
  })
}

export function verifySignInCode(email: string, token: string) {
  return supabase.auth.verifyOtp({ email, token, type: 'email' })
}

export function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export type OAuthProvider = 'github' | 'google'

function isOAuthProvider(name: string): name is OAuthProvider {
  return name === 'github' || name === 'google'
}

/** The providers in VITE_AUTH_PROVIDERS ("github,google"), in that order. */
export function authProviders(): OAuthProvider[] {
  const names = (import.meta.env.VITE_AUTH_PROVIDERS ?? '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
  return [...new Set(names)].filter(isOAuthProvider)
}

/**
 * Leaves for the provider's sign-in page. It comes back to /login, where
 * supabase-js picks the session out of the URL and the route forwards to
 * `redirect`.
 */
export function signInWithProvider(provider: OAuthProvider, redirect: string) {
  const redirectTo = new URL(
    `/login?redirect=${encodeURIComponent(redirect)}`,
    window.location.origin,
  )
  return supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo.href } })
}

let redirectErrorTaken = false

/**
 * Why the OAuth or email-link sign-in that loaded this page failed, if it
 * did. Only the first call gets it, so the message doesn't come back each
 * time the sign-in form mounts.
 */
export async function redirectError(): Promise<string | null> {
  if (redirectErrorTaken) return null
  redirectErrorTaken = true
  const { error } = await supabase.auth.initialize()
  return error ? describeAuthError(error) : null
}

type PasswordChange =
  | { status: 'done' }
  | { status: 'code-sent' }
  | { status: 'error'; message: string }

/**
 * Sets the signed-in user's password. With Supabase's "Secure password
 * change" on and a session older than a day, it emails a code instead; call
 * again with that code as the nonce.
 */
export async function changePassword(password: string, nonce?: string): Promise<PasswordChange> {
  // has_password: Supabase can't tell the app whether an account has one.
  const { error } = await supabase.auth.updateUser({ password, nonce, data: { has_password: true } })
  if (!error) return { status: 'done' }
  if (error.code === 'same_password') {
    // It already is the password, so there is one. Supabase rejected the
    // update before writing the flag, so write it on its own.
    await supabase.auth.updateUser({ data: { has_password: true } })
    return { status: 'done' }
  }
  if (error.code === 'reauthentication_needed') {
    const { error: sendError } = await supabase.auth.reauthenticate()
    if (sendError) return { status: 'error', message: describeAuthError(sendError) }
    return { status: 'code-sent' }
  }
  return { status: 'error', message: describeAuthError(error) }
}

/**
 * Whether to suggest setting a password: this session started with an
 * emailed code or link, and no password was ever set from the app. A session
 * that started with a password proves one exists, so it marks the account.
 */
export async function passwordMissing(): Promise<boolean> {
  let user = (await getSession())?.user
  if (!user || user.user_metadata.has_password) return false
  // The stored user can predate a password set on another device, which also
  // ended this session. A refresh gets the account as it is now.
  const { data: refreshed, error } = await supabase.auth.refreshSession()
  if (error && !isAuthRetryableFetchError(error)) {
    // The session is gone server-side, but an explicit refresh leaves it in
    // storage (supabase-js only drops it on its own next refresh, up to an
    // hour away). Sign out now; SIGNED_OUT goes to /login.
    await signOut()
    return false
  }
  if (refreshed.user) user = refreshed.user
  if (user.user_metadata.has_password) return false
  // The session's sign-in methods, read from its token without a request.
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  const methods = (data?.currentAuthenticationMethods ?? []).map((m) =>
    typeof m === 'string' ? m : m.method,
  )
  if (methods.includes('password')) {
    // Only a hint: if this fails, the next password sign-in tries again.
    void supabase.auth.updateUser({ data: { has_password: true } })
    return false
  }
  return methods.includes('otp') || methods.includes('magiclink')
}

export function signOut() {
  // The default scope, 'global', also signs out every other device.
  return supabase.auth.signOut({ scope: 'local' })
}

/** One sentence for the person signing in, from any supabase-js auth error. */
export function describeAuthError(error: unknown): string {
  if (isAuthWeakPasswordError(error)) {
    // For 'length' and 'characters' the server's message names the exact rule.
    return error.reasons.includes('pwned')
      ? 'That password has appeared in a data breach. Choose another one.'
      : error.message
  }
  if (isAuthRetryableFetchError(error)) {
    // auth-js uses this class for requests that got no answer (status 0) and
    // for 5xx answers, e.g. 500 "Error sending magic link email" when SMTP fails.
    return error.status === 0
      ? "Can't reach the server. Check your connection, then try again."
      : `The server had a problem (${error.message}). Try again later.`
  }
  if (!isAuthError(error)) {
    return error instanceof Error ? error.message : 'Something went wrong. Try again.'
  }
  // A failed OAuth or email-link redirect carries the server's code in `details`.
  const code = isAuthImplicitGrantRedirectError(error) ? error.details?.code : error.code
  switch (code) {
    case 'invalid_credentials':
      // Also what an account without a password of its own gets.
      return 'Wrong email or password. No password yet? Sign in with an email code, then set one from the account menu.'
    case 'signup_disabled':
    case 'otp_disabled':
      return 'There is no DoIT account for that email.'
    case 'otp_expired':
      return 'That code is wrong or has expired. Check the latest email, or ask for a new code.'
    case 'reauthentication_not_valid':
      return 'That code is wrong or has expired. To get a new one, close this and start again.'
    case 'same_password':
      return 'That is already your password.'
    case 'email_not_confirmed':
      return "Your email isn't confirmed yet. Sign in with an email code instead."
    case 'provider_email_needs_verification':
      return "Your email isn't verified with that provider yet. Sign in with an email code instead."
    case 'current_password_required':
      // Sessions started with an email code or link skip this check.
      return 'To change your password, sign out, sign in with an email code, then set the new one here.'
    case 'over_email_send_rate_limit':
      return 'Too many emails sent. Wait a bit, then try again.'
    case 'over_request_rate_limit':
      return 'Too many attempts. Wait a few minutes, then try again.'
    default:
      // A failed redirect's message is the link's error_description, which
      // anyone can put in a URL, so only the codes above get their own text.
      return isAuthImplicitGrantRedirectError(error)
        ? "Sign-in didn't finish. Try again."
        : error.message
  }
}
