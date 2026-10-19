import { useEffect, useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { CheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import {
  type OAuthProvider,
  authProviders,
  describeAuthError,
  getSession,
  redirectError,
  sendSignInCode,
  signInWithPassword,
  signInWithProvider,
  verifySignInCode,
} from '@/lib/auth'

// Only same-origin paths, so the redirect can't send people elsewhere.
function safeRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/'
  }
  return value
}

export const Route = createFileRoute('/login')({
  validateSearch: (search) => ({ redirect: safeRedirect(search.redirect) }),
  beforeLoad: async ({ search }) => {
    if (await getSession()) throw redirect({ to: search.redirect })
  },
  component: LoginPage,
})

const passwordSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})
const emailSchema = z.object({ email: z.email('Enter a valid email address') })
const codeSchema = z.object({
  code: z.string().regex(/^\d{6,8}$/, 'Enter the code from the email'),
})

const providerNames: Record<OAuthProvider, string> = { github: 'GitHub', google: 'Google' }

// Which form shows. The email typed so far carries over between them.
type Step = { name: 'password' | 'email' | 'code'; email: string }

function LoginPage() {
  const [step, setStep] = useState<Step>({ name: 'password', email: '' })

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center justify-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CheckIcon />
          </span>
          <span className="text-xl font-bold tracking-tight">DoIT</span>
        </div>
        {step.name === 'password' ? (
          <PasswordStep
            defaultEmail={step.email}
            onUseCode={(email) => setStep({ name: 'email', email })}
          />
        ) : step.name === 'email' ? (
          <EmailStep
            defaultEmail={step.email}
            onSent={(email) => setStep({ name: 'code', email })}
            onUsePassword={(email) => setStep({ name: 'password', email })}
          />
        ) : (
          <CodeStep
            email={step.email}
            onBack={() => setStep({ name: 'email', email: step.email })}
          />
        )}
      </div>
    </main>
  )
}

function PasswordStep({
  defaultEmail,
  onUseCode,
}: {
  defaultEmail: string
  onUseCode: (email: string) => void
}) {
  const router = useRouter()
  const { redirect: to } = Route.useSearch()
  const [error, setError] = useState<string | null>(null)
  const providers = authProviders()
  const form = useForm({
    defaultValues: { email: defaultEmail, password: '' },
    validators: { onSubmit: passwordSchema },
    onSubmit: async ({ value }) => {
      setError(null)
      const { error } = await signInWithPassword(value.email.trim(), value.password)
      if (error) setError(describeAuthError(error))
      // `to` is any same-origin path (validated above), not a typed route.
      else router.history.push(to)
    },
  })

  // A failed OAuth or email-link sign-in comes back here with the reason.
  useEffect(() => {
    void redirectError().then((message) => {
      if (message) setError(message)
    })
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <FieldGroup>
            {providers.length > 0 ? (
              <>
                <Field>
                  {providers.map((provider) => (
                    <Button
                      key={provider}
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={() =>
                        void signInWithProvider(provider, to).then(({ error }) => {
                          if (error) setError(describeAuthError(error))
                        })
                      }
                    >
                      Continue with {providerNames[provider]}
                    </Button>
                  ))}
                </Field>
                {/* The label sits on the card, not on the page background. */}
                <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                  or
                </FieldSeparator>
              </>
            ) : null}
            <form.Field name="email">
              {(field) => {
                const invalid = field.state.meta.errors.length > 0
                return (
                  <Field data-invalid={invalid || undefined}>
                    <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                    <Input
                      id={field.name}
                      type="email"
                      autoComplete="username"
                      autoFocus={!defaultEmail}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={invalid || undefined}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )
              }}
            </form.Field>
            <form.Field name="password">
              {(field) => {
                const invalid = field.state.meta.errors.length > 0
                return (
                  <Field data-invalid={invalid || undefined}>
                    <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                    <Input
                      id={field.name}
                      type="password"
                      autoComplete="current-password"
                      autoFocus={Boolean(defaultEmail)}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={invalid || undefined}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )
              }}
            </form.Field>
            {error ? <FieldError>{error}</FieldError> : null}
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
                  Sign in
                </Button>
              )}
            </form.Subscribe>
            <FieldDescription className="text-center">
              No password yet?{' '}
              <Button
                type="button"
                variant="link"
                className="h-auto p-0"
                onClick={() => onUseCode(form.getFieldValue('email').trim())}
              >
                Email me a code instead
              </Button>
            </FieldDescription>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

function EmailStep({
  defaultEmail,
  onSent,
  onUsePassword,
}: {
  defaultEmail: string
  onSent: (email: string) => void
  onUsePassword: (email: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const form = useForm({
    defaultValues: { email: defaultEmail },
    validators: { onSubmit: emailSchema },
    onSubmit: async ({ value }) => {
      setError(null)
      const { error } = await sendSignInCode(value.email.trim())
      if (error) setError(describeAuthError(error))
      else onSent(value.email.trim())
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          We'll email you a code. New here? The same step creates your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <FieldGroup>
            <form.Field name="email">
              {(field) => {
                const invalid = field.state.meta.errors.length > 0
                return (
                  <Field data-invalid={invalid || undefined}>
                    <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                    <Input
                      id={field.name}
                      type="email"
                      autoComplete="email"
                      autoFocus
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={invalid || undefined}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )
              }}
            </form.Field>
            {error ? <FieldError>{error}</FieldError> : null}
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
                  Email me a code
                </Button>
              )}
            </form.Subscribe>
            <FieldDescription className="text-center">
              <Button
                type="button"
                variant="link"
                className="h-auto p-0"
                onClick={() => onUsePassword(form.getFieldValue('email').trim())}
              >
                Use your password instead
              </Button>
            </FieldDescription>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

function CodeStep({ email, onBack }: { email: string; onBack: () => void }) {
  const router = useRouter()
  const { redirect: to } = Route.useSearch()
  const [error, setError] = useState<string | null>(null)
  const form = useForm({
    defaultValues: { code: '' },
    validators: { onSubmit: codeSchema },
    onSubmit: async ({ value }) => {
      setError(null)
      const { error } = await verifySignInCode(email, value.code)
      if (error) setError(describeAuthError(error))
      // `to` is any same-origin path (validated above), not a typed route.
      else router.history.push(to)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          We sent a code to <span className="font-medium text-foreground">{email}</span>.
          You can also just click the link in that email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <FieldGroup>
            <form.Field name="code">
              {(field) => {
                const invalid = field.state.meta.errors.length > 0
                return (
                  <Field data-invalid={invalid || undefined}>
                    <FieldLabel htmlFor={field.name}>Code</FieldLabel>
                    <Input
                      id={field.name}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      className="font-mono tracking-[0.3em]"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value.replace(/\D/g, ''))}
                      onBlur={field.handleBlur}
                      aria-invalid={invalid || undefined}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )
              }}
            </form.Field>
            {error ? <FieldError>{error}</FieldError> : null}
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
                  Sign in
                </Button>
              )}
            </form.Subscribe>
            <FieldDescription className="text-center">
              Wrong address?{' '}
              <Button type="button" variant="link" className="h-auto p-0" onClick={onBack}>
                Use another email
              </Button>
            </FieldDescription>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
