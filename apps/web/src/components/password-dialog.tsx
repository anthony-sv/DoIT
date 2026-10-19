import { useEffect, useRef, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { useHasPassword } from '@/hooks/use-has-password'
import { changePassword, currentUserEmail, passwordMissing } from '@/lib/auth'

const passwordSchema = z
  .object({
    // Supabase hashes passwords with bcrypt, which only reads 72 characters.
    password: z.string().min(8, 'Use at least 8 characters').max(72, 'Use at most 72 characters'),
    confirm: z.string(),
    // Checked by its own field, which only shows once a code was sent.
    code: z.string(),
  })
  .refine((value) => value.confirm === value.password, {
    message: "The passwords don't match",
    path: ['confirm'],
  })
const codeSchema = z.string().regex(/^\d{6,10}$/, 'Enter the code from the email')

const OPEN_EVENT = 'doit:set-password'

export function openPasswordDialog() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

/**
 * The Set (or Change) password dialog, and a reminder while this session
 * started with an emailed code and no password was set. It lives in the app
 * layout rather than the account menu: on phones the sidebar unmounts while
 * it's closed.
 */
export function PasswordSetup() {
  const [open, setOpen] = useState(false)
  const reminder = useRef<string | null>(null)
  const passwordSet = useHasPassword()

  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, show)
    return () => window.removeEventListener(OPEN_EVENT, show)
  }, [])

  useEffect(() => {
    let cancelled = false
    void passwordMissing().then((missing) => {
      if (!missing || cancelled) return
      reminder.current = toast.add({
        type: 'warning',
        title: 'No password set',
        description: 'You signed in through an email code or link. Set a password to skip the email next time.',
        // Stays until dismissed or the password is set.
        timeout: 0,
        actionProps: { children: 'Set password', onClick: () => setOpen(true) },
      })
    })
    return () => {
      cancelled = true
      if (reminder.current) toast.close(reminder.current)
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        {/* Mounts with each opening, so every attempt starts empty. */}
        <PasswordForm
          changing={passwordSet}
          onDone={() => {
            if (reminder.current) toast.close(reminder.current)
            setOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function PasswordForm({ changing: hadPassword, onDone }: { changing: boolean; onDone: () => void }) {
  // As it was when the dialog opened: setting the first password flips
  // useHasPassword mid-submit, and this attempt should still read "Set".
  const [changing] = useState(hadPassword)
  // Supabase asked to confirm it's really you (see changePassword).
  const [codeSent, setCodeSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const form = useForm({
    defaultValues: { password: '', confirm: '', code: '' },
    validators: { onSubmit: passwordSchema },
    onSubmit: async ({ value }) => {
      setError(null)
      const result = await changePassword(value.password, codeSent ? value.code : undefined)
      if (result.status === 'error') {
        setError(result.message)
      } else if (result.status === 'code-sent') {
        setCodeSent(true)
      } else {
        toast.add({
          title: changing ? 'Password changed' : 'Password set',
          description: changing
            ? 'Use the new one next time you sign in.'
            : 'Next time, sign in with your email and password.',
          type: 'success',
        })
        onDone()
      }
    },
  })

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <DialogHeader>
        <DialogTitle>{changing ? 'Change your password' : 'Set a password'}</DialogTitle>
        <DialogDescription>
          {changing
            ? 'From now on, sign in with your email and the new password. Changing it signs you out on your other devices.'
            : 'Then you can sign in with your email and this password instead of a code. Setting it signs you out on your other devices.'}
        </DialogDescription>
      </DialogHeader>
      {/* Tells password managers which account the new password belongs to. */}
      <input type="email" autoComplete="username" value={currentUserEmail()} readOnly hidden />
      <FieldGroup>
        <form.Field name="password">
          {(field) => {
            const invalid = field.state.meta.errors.length > 0
            return (
              <Field data-invalid={invalid || undefined}>
                <FieldLabel htmlFor="new-password">New password</FieldLabel>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
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
        <form.Field name="confirm">
          {(field) => {
            const invalid = field.state.meta.errors.length > 0
            return (
              <Field data-invalid={invalid || undefined}>
                <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
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
        {codeSent ? (
          <form.Field name="code" validators={{ onSubmit: codeSchema }}>
            {(field) => {
              const invalid = field.state.meta.errors.length > 0
              return (
                <Field data-invalid={invalid || undefined}>
                  <FieldLabel htmlFor="password-code">Code from your email</FieldLabel>
                  <Input
                    id="password-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    className="font-mono tracking-[0.3em]"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value.replace(/\D/g, ''))}
                    onBlur={field.handleBlur}
                    aria-invalid={invalid || undefined}
                  />
                  <FieldDescription>To confirm it's you, we emailed you a code.</FieldDescription>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )
            }}
          </form.Field>
        ) : null}
        {error ? <FieldError>{error}</FieldError> : null}
      </FieldGroup>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              {changing ? 'Change password' : 'Set password'}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  )
}
