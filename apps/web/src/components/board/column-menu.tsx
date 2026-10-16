import { useState } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/toast'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { cardsCollection, columnsCollection } from '@/data/collections'
import { removeColumn } from '@/data/actions'
import { type Column, type LabelColor, labelColors } from '@/data/schemas'
import { ColorPicker } from '@/components/color-picker'

export function ColumnMenu({
  column,
  columns,
  className,
}: {
  column: Column
  columns: Column[]
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className={className}
              aria-label={`${column.name} column options`}
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <PencilIcon />
              Edit column…
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              disabled={columns.length <= 1}
              onClick={() => setDeleting(true)}
            >
              <Trash2Icon />
              Delete column…
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditColumnDialog column={column} open={editing} onOpenChange={setEditing} />
      <DeleteColumnDialog
        column={column}
        columns={columns}
        open={deleting}
        onOpenChange={setDeleting}
      />
    </>
  )
}

const columnFormSchema = z.object({
  name: z.string().trim().min(1, 'Give the column a name').max(60),
  color: z.enum(labelColors),
  wipLimit: z.string().regex(/^\d{0,3}$/, 'A whole number, or empty for no limit'),
  isDone: z.boolean(),
})

function EditColumnDialog({
  column,
  open,
  onOpenChange,
}: {
  column: Column
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const form = useForm({
    defaultValues: {
      name: column.name,
      color: column.color as LabelColor,
      wipLimit: column.wip_limit?.toString() ?? '',
      isDone: column.is_done,
    },
    validators: { onSubmit: columnFormSchema },
    onSubmit: ({ value }) => {
      const limit = Number.parseInt(value.wipLimit, 10)
      columnsCollection
        .update(column.id, (draft) => {
          draft.name = value.name.trim()
          draft.color = value.color
          draft.wip_limit = limit > 0 ? limit : null
          draft.is_done = value.isDone
        })
        .isPersisted.promise.catch((error: Error) =>
          toast.add({ title: 'Column not saved', description: error.message, type: 'error' }),
        )
      onOpenChange(false)
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) form.reset()
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <form
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit column</DialogTitle>
            <DialogDescription>Changes apply to this board only.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <form.Field name="name">
              {(field) => {
                const invalid = field.state.meta.errors.length > 0
                return (
                  <Field data-invalid={invalid || undefined}>
                    <FieldLabel htmlFor="column-name">Name</FieldLabel>
                    <Input
                      id="column-name"
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
            <form.Field name="color">
              {(field) => (
                <Field>
                  <FieldLabel>Color</FieldLabel>
                  <ColorPicker value={field.state.value} onChange={field.handleChange} />
                </Field>
              )}
            </form.Field>
            <form.Field name="wipLimit">
              {(field) => {
                const invalid = field.state.meta.errors.length > 0
                return (
                  <Field data-invalid={invalid || undefined}>
                    <FieldLabel htmlFor="column-wip">Work-in-progress limit</FieldLabel>
                    <Input
                      id="column-wip"
                      inputMode="numeric"
                      className="w-24"
                      placeholder="None"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value.replace(/\D/g, ''))}
                      onBlur={field.handleBlur}
                      aria-invalid={invalid || undefined}
                    />
                    <FieldDescription>
                      The column header turns red when it holds more cards than this.
                    </FieldDescription>
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )
              }}
            </form.Field>
            <form.Field name="isDone">
              {(field) => (
                <Field orientation="horizontal">
                  <Checkbox
                    id="column-done"
                    checked={field.state.value}
                    onCheckedChange={(checked) => field.handleChange(checked === true)}
                  />
                  <FieldContent>
                    <FieldLabel htmlFor="column-done">Cards here are done</FieldLabel>
                    <FieldDescription>
                      Counts toward sprint progress and the burndown.
                    </FieldDescription>
                  </FieldContent>
                </Field>
              )}
            </form.Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteColumnDialog({
  column,
  columns,
  open,
  onOpenChange,
}: {
  column: Column
  columns: Column[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const others = columns.filter((c) => c.id !== column.id)
  // Includes cards hidden by the sprint filter: all of them move.
  const cards = useLiveQuery({
    query: (q) =>
      q.from({ card: cardsCollection }).where(({ card }) => eq(card.column_id, column.id)),
  }).data
  const [moveToId, setMoveToId] = useState<string | null>(others[0]?.id ?? null)
  const moveTo = others.find((c) => c.id === moveToId) ?? others[0] ?? null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{column.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {cards.length === 0
              ? 'The column is empty, so nothing else changes.'
              : `Its ${cards.length} ${cards.length === 1 ? 'card moves' : 'cards move'} to the column you pick. No cards are deleted.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {cards.length > 0 ? (
          <Field>
            <FieldLabel>Move cards to</FieldLabel>
            <Select value={moveTo?.id ?? null} onValueChange={(v) => setMoveToId(v)}>
              <SelectTrigger>
                <SelectValue>{(id: string) => others.find((c) => c.id === id)?.name}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {others.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              removeColumn(column, moveTo).isPersisted.promise.catch((error: Error) =>
                toast.add({ title: 'Column not deleted', description: error.message, type: 'error' }),
              )
              onOpenChange(false)
            }}
          >
            Delete column
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
