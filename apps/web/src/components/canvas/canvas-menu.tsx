import { type ReactElement, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { EllipsisIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { boardsCollection, canvasesCollection } from '@/data/collections'
import type { Canvas } from '@/data/schemas'
import { readLastBoard } from '@/lib/last-board'
import { canvasNameSchema, deletedHere } from './canvas-ui'

function reportFailure(what: string) {
  return (error: Error) => toast.add({ title: what, description: error.message, type: 'error' })
}

/**
 * Rename and delete for one drawing. It renders its own dialogs, so the
 * drawing's page and every sidebar row can each show one.
 */
export function CanvasMenu({
  canvas,
  trigger = <Button variant="ghost" size="icon-sm" />,
}: {
  canvas: Canvas
  /** The element that opens the menu; it gets the ellipsis icon and a label. */
  trigger?: ReactElement
}) {
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()
  const { canvasId } = useParams({ strict: false })

  async function remove() {
    setDeleting(false)
    // Before leaving: the page saves its last change on the way out, and that
    // write (or one still uploading) can reach Postgres after the delete.
    deletedHere.add(canvas.id)
    if (canvasId === canvas.id) {
      // Off the drawing first, so its page never renders without it: back to
      // the board you were last on, or home. Replace, since going back would
      // land on a drawing that is gone. Past the page's "Leave without
      // saving?": it doesn't apply to a drawing being deleted, and after Stay
      // this await would only settle on the next navigation, deleting then.
      const last = readLastBoard()
      const board = last ? boardsCollection.get(last) : undefined
      await (board
        ? navigate({
            to: '/b/$boardId',
            params: { boardId: board.id },
            replace: true,
            ignoreBlocker: true,
          })
        : navigate({ to: '/', replace: true, ignoreBlocker: true }))
    }
    canvasesCollection.delete(canvas.id).isPersisted.promise.catch((error: Error) => {
      deletedHere.delete(canvas.id) // not deleted after all: a write that finds no row is news again
      reportFailure('Drawing not deleted')(error)
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={trigger} aria-label={`${canvas.name} options`}>
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setRenaming(true)}>
              <PencilIcon />
              Rename…
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
              <Trash2Icon />
              Delete…
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          {/* Mounts with each opening, so the form starts from the name as it is now. */}
          <RenameForm canvas={canvas} onDone={() => setRenaming(false)} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{canvas.name}”?</AlertDialogTitle>
            <AlertDialogDescription>The drawing is deleted for good.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void remove()}>
              Delete drawing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

const renameSchema = z.object({ name: canvasNameSchema })

function RenameForm({ canvas, onDone }: { canvas: Canvas; onDone: () => void }) {
  const form = useForm({
    defaultValues: { name: canvas.name },
    validators: { onSubmit: renameSchema },
    onSubmit: ({ value }) => {
      const name = value.name.trim()
      if (name !== canvas.name) {
        canvasesCollection
          .update(canvas.id, (draft) => {
            draft.name = name
          })
          .isPersisted.promise.catch(reportFailure('Drawing not renamed'))
      }
      onDone()
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
        <DialogTitle>Rename drawing</DialogTitle>
      </DialogHeader>
      <FieldGroup>
        <form.Field name="name">
          {(field) => {
            const invalid = field.state.meta.errors.length > 0
            return (
              <Field data-invalid={invalid || undefined}>
                <FieldLabel htmlFor="rename-canvas-name">Name</FieldLabel>
                <Input
                  id="rename-canvas-name"
                  autoFocus
                  maxLength={80}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-invalid={invalid || undefined}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )
          }}
        </form.Field>
      </FieldGroup>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  )
}
