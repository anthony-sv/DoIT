import { useForm } from '@tanstack/react-form'
import { ColorPicker } from '@/components/color-picker'
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
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { boardsCollection } from '@/data/collections'
import type { Board } from '@/data/schemas'
import { boardFormSchema } from './board-form'

export function EditBoardDialog({
  board,
  open,
  onOpenChange,
}: {
  board: Board
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mounts with each opening, so the form starts from the board as it is now. */}
        <EditBoardForm board={board} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function EditBoardForm({ board, onDone }: { board: Board; onDone: () => void }) {
  const form = useForm({
    defaultValues: { name: board.name, key: board.key, color: board.color },
    validators: { onSubmit: boardFormSchema },
    onSubmit: ({ value }) => {
      boardsCollection
        .update(board.id, (draft) => {
          draft.name = value.name.trim()
          draft.key = value.key
          draft.color = value.color
        })
        .isPersisted.promise.catch((error: Error) =>
          toast.add({ title: 'Board not saved', description: error.message, type: 'error' }),
        )
      onDone()
    },
  })
  // The newest card makes the example key a real one.
  const example = Math.max(1, board.next_number - 1)

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
        <DialogTitle>Edit board</DialogTitle>
      </DialogHeader>
      <FieldGroup>
        <form.Field name="name">
          {(field) => {
            const invalid = field.state.meta.errors.length > 0
            return (
              <Field data-invalid={invalid || undefined}>
                <FieldLabel htmlFor="edit-board-name">Name</FieldLabel>
                <Input
                  id="edit-board-name"
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
        <form.Field name="key">
          {(field) => {
            const invalid = field.state.meta.errors.length > 0
            const next = field.state.value || 'KEY'
            return (
              <Field data-invalid={invalid || undefined}>
                <FieldLabel htmlFor="edit-board-key">Card prefix</FieldLabel>
                <Input
                  id="edit-board-key"
                  className="font-mono uppercase"
                  maxLength={6}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value.toUpperCase())}
                  onBlur={field.handleBlur}
                  aria-invalid={invalid || undefined}
                />
                <FieldDescription>
                  {field.state.value === board.key
                    ? `Changing it renames every card key, like ${board.key}-${example}.`
                    : `Every card key changes: ${board.key}-${example} becomes ${next}-${example}.`}
                </FieldDescription>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )
          }}
        </form.Field>
        <form.Field name="color">
          {(field) => (
            <Field aria-labelledby="edit-board-color">
              <FieldTitle id="edit-board-color">Color</FieldTitle>
              <ColorPicker value={field.state.value} onChange={field.handleChange} />
            </Field>
          )}
        </form.Field>
      </FieldGroup>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  )
}
