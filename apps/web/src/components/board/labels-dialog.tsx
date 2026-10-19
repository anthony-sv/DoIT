import { useId, useMemo, useState } from 'react'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { PlusIcon, TagIcon, Trash2Icon } from 'lucide-react'
import { ColorPicker } from '@/components/color-picker'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/ui/toast'
import { cardsCollection, labelsCollection } from '@/data/collections'
import { removeLabel } from '@/data/actions'
import { type Board, type Label, type LabelColor, labelColors } from '@/data/schemas'
import { currentUserId } from '@/lib/auth'
import { colorClasses, colorNames } from '@/lib/colors'
import { cn } from '@/lib/utils'

function reportFailure(what: string) {
  return (error: Error) => toast.add({ title: what, description: error.message, type: 'error' })
}

// Case doesn't make a different label, as in the card's label picker.
function nameTaken(labels: Label[], name: string, exceptId?: string) {
  const lower = name.toLowerCase()
  return labels.some((l) => l.id !== exceptId && l.name.toLowerCase() === lower)
}

function cardCount(n: number) {
  return `${n} ${n === 1 ? 'card' : 'cards'}`
}

export function LabelsDialog({
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Labels</DialogTitle>
          <DialogDescription>
            For cards on {board.name}. A new name or color shows on every card with the label.
          </DialogDescription>
        </DialogHeader>
        {/* Inside the content, so its queries only run while the dialog is open. */}
        <BoardLabels board={board} />
      </DialogContent>
    </Dialog>
  )
}

function BoardLabels({ board }: { board: Board }) {
  const { data: labels } = useLiveQuery({
    query: (q) =>
      q
        .from({ label: labelsCollection })
        .where(({ label }) => eq(label.board_id, board.id))
        .orderBy(({ label }) => label.created_at),
  })
  const { data: cards } = useLiveQuery({
    query: (q) =>
      q
        .from({ card: cardsCollection })
        .where(({ card }) => eq(card.board_id, board.id))
        .select(({ card }) => ({ label_ids: card.label_ids })),
  })
  const uses = useMemo(() => {
    const map = new Map<string, number>()
    for (const card of cards) {
      for (const id of card.label_ids) map.set(id, (map.get(id) ?? 0) + 1)
    }
    return map
  }, [cards])

  return (
    <div className="flex flex-col gap-4">
      {labels.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TagIcon />
            </EmptyMedia>
            <EmptyTitle>No labels yet</EmptyTitle>
            <EmptyDescription>Add one below, or from the label picker on a card.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        // The padding keeps focus rings clear of the scroll edge.
        <ul className="-mx-1 flex max-h-[min(20rem,40svh)] flex-col gap-2 overflow-y-auto p-1">
          {labels.map((label) => (
            <LabelRow
              key={label.id}
              label={label}
              labels={labels}
              uses={uses.get(label.id) ?? 0}
            />
          ))}
        </ul>
      )}
      <Separator />
      <AddLabel board={board} labels={labels} />
    </div>
  )
}

function LabelRow({ label, labels, uses }: { label: Label; labels: Label[]; uses: number }) {
  // What is being typed; null shows the stored name, so a rename that fails
  // and rolls back shows the name that is really saved.
  const [draft, setDraft] = useState<string | null>(null)
  const errorId = useId()
  const trimmed = (draft ?? label.name).trim()
  // An empty name just cancels, as in the app's other inline renames. A clash is
  // explained under the row before blur puts the saved name back.
  const taken = draft !== null && trimmed !== '' && nameTaken(labels, trimmed, label.id)

  function rename() {
    setDraft(null)
    if (!trimmed || taken || trimmed === label.name) return
    labelsCollection
      .update(label.id, (d) => {
        d.name = trimmed
      })
      .isPersisted.promise.catch(reportFailure('Label not renamed'))
  }

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <ColorButton
          color={label.color}
          name={label.name}
          onChange={(color) =>
            labelsCollection
              .update(label.id, (d) => {
                d.color = color
              })
              .isPersisted.promise.catch(reportFailure('Label color not saved'))
          }
        />
        <Input
          aria-label={`Rename ${label.name}`}
          maxLength={30}
          value={draft ?? label.name}
          aria-invalid={taken || undefined}
          aria-describedby={taken ? errorId : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={rename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape' && draft !== null) {
              // Undo the edit; the next Escape closes the dialog.
              e.stopPropagation()
              setDraft(null)
            }
          }}
        />
        <span className="w-18 shrink-0 text-right text-xs text-muted-foreground">
          {uses === 0 ? 'unused' : `on ${cardCount(uses)}`}
        </span>
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant="ghost" size="icon-sm" aria-label={`Delete ${label.name}`} />}
          >
            <Trash2Icon />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{label.name}”?</AlertDialogTitle>
              <AlertDialogDescription>
                {uses === 0 ? 'No card has it.' : `It comes off ${cardCount(uses)}.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() =>
                  removeLabel(label).isPersisted.promise.catch(reportFailure('Label not deleted'))
                }
              >
                Delete label
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {taken ? (
        // pl-9 = color button (size-7) + gap-2, so the text lines up with the input.
        <FieldError id={errorId} className="pl-9">
          There’s already a label called “{trimmed}”.
        </FieldError>
      ) : null}
    </li>
  )
}

function AddLabel({ board, labels }: { board: Board; labels: Label[] }) {
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<LabelColor | null>(null)
  // New labels cycle through the palette so neighbours differ, as on a card.
  const color = picked ?? labelColors[labels.length % labelColors.length]!
  const trimmed = name.trim()
  const taken = nameTaken(labels, trimmed)

  function add() {
    if (!trimmed || taken) return
    labelsCollection
      .insert({
        id: crypto.randomUUID(),
        owner_id: currentUserId(),
        board_id: board.id,
        name: trimmed,
        color,
        created_at: new Date().toISOString(),
      })
      .isPersisted.promise.catch(reportFailure('Label not saved'))
    setName('')
    setPicked(null)
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        add()
      }}
    >
      <Field data-invalid={taken || undefined}>
        <FieldLabel htmlFor="new-label-name">New label</FieldLabel>
        <div className="flex items-center gap-2">
          <ColorButton color={color} name="New label" onChange={setPicked} />
          <Input
            id="new-label-name"
            autoComplete="off"
            maxLength={30}
            placeholder="Bug, Design, Blocked…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={taken || undefined}
          />
          <Button type="submit" variant="outline" disabled={!trimmed || taken}>
            <PlusIcon data-icon="inline-start" />
            Add
          </Button>
        </div>
        {taken ? <FieldError>There’s already a label called “{trimmed}”.</FieldError> : null}
      </Field>
    </form>
  )
}

function ColorButton({
  color,
  name,
  onChange,
}: {
  color: LabelColor
  name: string
  onChange: (color: LabelColor) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`${name} color: ${colorNames[color]}`}
          />
        }
      >
        <span className={cn('size-3 rounded-full', colorClasses[color].dot)} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <ColorPicker
          value={color}
          onChange={(next) => {
            onChange(next)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
