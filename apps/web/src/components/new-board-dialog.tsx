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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { boardsCollection } from '@/data/collections'
import { createBoard, newBoard, suggestBoardKey } from '@/data/actions'
import { type LabelColor, labelColors } from '@/data/schemas'
import { positionAfterLast } from '@/lib/position'
import { ColorPicker } from './color-picker'

const boardFormSchema = z.object({
  name: z.string().trim().min(1, 'Give the board a name').max(80),
  key: z
    .string()
    .regex(/^[A-Z][A-Z0-9]{0,5}$/, '1–6 capital letters or digits, starting with a letter'),
  color: z.enum(labelColors),
})

export function NewBoardDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const form = useForm({
    defaultValues: { name: '', key: '', color: 'blue' as LabelColor },
    validators: { onSubmit: boardFormSchema },
    onSubmit: ({ value, formApi }) => {
      const position = positionAfterLast(
        boardsCollection.toArray.map((b) => b.position).sort((a, b) => a - b),
      )
      const input = newBoard({ ...value, position })
      const tx = createBoard(input)
      tx.isPersisted.promise.catch((error: Error) =>
        toast.add({ title: 'Board not saved', description: error.message, type: 'error' }),
      )
      formApi.reset()
      onOpenChange(false)
      void navigate({ to: '/b/$boardId', params: { boardId: input.board.id } })
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
          className="flex flex-col gap-6"
        >
          <DialogHeader>
            <DialogTitle>New board</DialogTitle>
            <DialogDescription>
              It starts with To do, In progress, Review and Done. You can change the columns
              later.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <form.Field
              name="name"
              listeners={{
                onChange: ({ value, fieldApi }) => {
                  // Keep suggesting a key until the user types their own.
                  if (!fieldApi.form.getFieldMeta('key')?.isDirty) {
                    fieldApi.form.setFieldValue('key', suggestBoardKey(value), {
                      dontUpdateMeta: true,
                    })
                  }
                },
              }}
            >
              {(field) => {
                const invalid = field.state.meta.errors.length > 0
                return (
                  <Field data-invalid={invalid || undefined}>
                    <FieldLabel htmlFor="board-name">Name</FieldLabel>
                    <Input
                      id="board-name"
                      autoFocus
                      placeholder="Devscope"
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
                return (
                  <Field data-invalid={invalid || undefined}>
                    <FieldLabel htmlFor="board-key">Card prefix</FieldLabel>
                    <Input
                      id="board-key"
                      className="font-mono uppercase"
                      maxLength={6}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value.toUpperCase())}
                      onBlur={field.handleBlur}
                      aria-invalid={invalid || undefined}
                    />
                    <FieldDescription>
                      {`Cards are numbered ${field.state.value || 'KEY'}-1, ${field.state.value || 'KEY'}-2…`}
                    </FieldDescription>
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )
              }}
            </form.Field>
            <form.Field name="color">
              {(field) => (
                <Field>
                  <FieldLabel>Color</FieldLabel>
                  <ColorPicker value={field.state.value} onChange={field.handleChange} />
                </Field>
              )}
            </form.Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Create board</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
