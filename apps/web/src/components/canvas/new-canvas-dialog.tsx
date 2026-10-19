import { useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
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
import { Field, FieldError, FieldGroup, FieldLabel, FieldTitle } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { canvasesCollection } from '@/data/collections'
import { type CanvasKind, canvasKinds } from '@/data/schemas'
import { currentUserId } from '@/lib/auth'
import { positionAfterLast } from '@/lib/position'
import { canvasNameSchema, kindIcons, kindLabels } from './canvas-ui'

const newCanvasSchema = z.object({ name: canvasNameSchema, kind: z.enum(canvasKinds) })

function untitled(kind: CanvasKind) {
  return `Untitled ${kindLabels[kind].toLowerCase()}`
}

export function NewCanvasDialog({
  open,
  onOpenChange,
  kind,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Picked when the dialog opens; it can still be changed inside. */
  kind: CanvasKind
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mounts with each opening, so it starts from the kind picked in the menu. */}
        <NewCanvasForm initialKind={kind} open={open} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function NewCanvasForm({
  initialKind,
  open,
  onDone,
}: {
  initialKind: CanvasKind
  open: boolean
  onDone: () => void
}) {
  const navigate = useNavigate()
  // Cancel, Esc and the backdrop still close the dialog while it saves. The
  // drawing gets created anyway, but a dialog closed by then must not
  // navigate (or close a newer one), so it offers the drawing instead.
  const stillOpen = useRef(open)
  useEffect(() => {
    stillOpen.current = open
    return () => {
      stillOpen.current = false
    }
  }, [open])
  const form = useForm({
    defaultValues: { name: untitled(initialKind), kind: initialKind },
    validators: { onSubmit: newCanvasSchema },
    onSubmit: async ({ value }) => {
      const id = crypto.randomUUID()
      const name = value.name.trim()
      const now = new Date().toISOString()
      const tx = canvasesCollection.insert({
        id,
        owner_id: currentUserId(),
        name,
        kind: value.kind,
        position: positionAfterLast(
          canvasesCollection.toArray.map((c) => c.position).sort((a, b) => a - b),
        ),
        created_at: now,
        updated_at: now,
      })
      try {
        // The drawing's page loads the row from Postgres, so it opens once
        // the row is there. Until then the button spins.
        await tx.isPersisted.promise
      } catch (error) {
        toast.add({
          title: 'Drawing not created',
          description: (error as Error).message,
          type: 'error',
        })
        return
      }
      const openDrawing = () => void navigate({ to: '/c/$canvasId', params: { canvasId: id } })
      if (!stillOpen.current) {
        const toastId = toast.add({
          title: 'Drawing created',
          description: name,
          type: 'success',
          actionProps: {
            children: 'Open',
            // Base UI leaves an action's toast up; this one is done once used.
            onClick: () => {
              toast.close(toastId)
              openDrawing()
            },
          },
        })
        return
      }
      onDone()
      openDrawing()
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
        <DialogTitle>New drawing</DialogTitle>
        <DialogDescription>
          Sketch freely on a whiteboard (Excalidraw), or lay out boxes and arrows in a diagram
          (draw.io).
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <form.Field name="name">
          {(field) => {
            const invalid = field.state.meta.errors.length > 0
            return (
              <Field data-invalid={invalid || undefined}>
                <FieldLabel htmlFor="new-canvas-name">Name</FieldLabel>
                <Input
                  id="new-canvas-name"
                  autoFocus
                  maxLength={80}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  // The suggested name is there to be typed over.
                  onFocus={(e) => e.currentTarget.select()}
                  aria-invalid={invalid || undefined}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )
          }}
        </form.Field>
        <form.Field
          name="kind"
          listeners={{
            onChange: ({ value, fieldApi }) => {
              // Keep the suggested name in step until the user types their own.
              if (!fieldApi.form.getFieldMeta('name')?.isDirty) {
                fieldApi.form.setFieldValue('name', untitled(value), { dontUpdateMeta: true })
              }
            },
          }}
        >
          {(field) => (
            <Field>
              <FieldTitle id="new-canvas-kind">Kind</FieldTitle>
              <ToggleGroup
                aria-labelledby="new-canvas-kind"
                variant="outline"
                value={[field.state.value]}
                onValueChange={(next) => {
                  // Single choice: ignore clicks that would clear it.
                  const kind = canvasKinds.find((k) => k === next[0])
                  if (kind) field.handleChange(kind)
                }}
              >
                {canvasKinds.map((kind) => {
                  const Icon = kindIcons[kind]
                  return (
                    <ToggleGroupItem key={kind} value={kind}>
                      <Icon data-icon="inline-start" />
                      {kindLabels[kind]}
                    </ToggleGroupItem>
                  )
                })}
              </ToggleGroup>
            </Field>
          )}
        </form.Field>
      </FieldGroup>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <form.Subscribe selector={(state) => [state.isSubmitting, state.values.kind] as const}>
          {([submitting, kind]) => (
            <Button type="submit" disabled={submitting}>
              {submitting ? <Spinner data-icon="inline-start" /> : null}
              Create {kindLabels[kind].toLowerCase()}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  )
}
