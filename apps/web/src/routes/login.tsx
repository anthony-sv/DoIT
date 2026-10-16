import { useState } from 'react'
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
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { getSession, sendSignInCode, verifySignInCode } from '@/lib/auth'

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

const emailSchema = z.object({ email: z.email('Enter a valid email address') })
const codeSchema = z.object({
  code: z.string().regex(/^\d{6,8}$/, 'Enter the code from the email'),
})

function LoginPage() {
  const [email, setEmail] = useState<string | null>(null)

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center justify-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CheckIcon />
          </span>
          <span className="text-xl font-bold tracking-tight">DoIT</span>
        </div>
        {email ? (
          <CodeStep email={email} onBack={() => setEmail(null)} />
        ) : (
          <EmailStep onSent={setEmail} />
        )}
      </div>
    </main>
  )
}

function EmailStep({ onSent }: { onSent: (email: string) => void }) {
  const [error, setError] = useState<string | null>(null)
  const form = useForm({
    defaultValues: { email: '' },
    validators: { onSubmit: emailSchema },
    onSubmit: async ({ value }) => {
      setError(null)
      const { error } = await sendSignInCode(value.email.trim())
      if (error) setError(error.message)
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
      if (error) setError(error.message)
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
