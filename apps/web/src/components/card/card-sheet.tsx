import { type RefObject, useRef, useState } from 'react'
import { debounceStrategy, usePacedMutations } from '@tanstack/react-db'
import { Markdown } from '@tanstack/markdown/react'
import { format, parseISO } from 'date-fns'
import { CalendarIcon, Trash2Icon, XIcon } from 'lucide-react'
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
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { cardsCollection } from '@/data/collections'
import { moveCard } from '@/data/actions'
import {
  type Board,
  type Card,
  type Column,
  type Label,
  type Priority,
  type Sprint,
  priorities,
} from '@/data/schemas'
import { positionAfterLast } from '@/lib/position'
import { supabase } from '@/lib/supabase'
import { cardKey, dueInfo, priorityNames, sprintRange } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CardActivity } from './card-activity'
import { CardChecklist } from './card-checklist'
import { LabelPicker } from './label-picker'

function reportFailure(what: string) {
  return (error: Error) => toast.add({ title: what, description: error.message, type: 'error' })
}

function updateCard(id: string, what: string, change: (draft: Card) => void) {
  cardsCollection.update(id, change).isPersisted.promise.catch(reportFailure(what))
}

export function CardSheet({
  card,
  board,
  columns,
  sprints,
  labels,
  onClose,
}: {
  card: Card | undefined
  board: Board
  columns: Column[]
  sprints: Sprint[]
  labels: Label[]
  onClose: () => void
}) {
  // Open on Close, not on the first button (Delete): a stray Enter must not
  // start deleting the card.
  const closeRef = useRef<HTMLButtonElement>(null)
  return (
    <Sheet open={card !== undefined} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 sm:max-w-xl"
        showCloseButton={false}
        initialFocus={closeRef}
      >
        {card ? (
          <CardDetail
            key={card.id}
            card={card}
            board={board}
            columns={columns}
            sprints={sprints}
            labels={labels}
            closeRef={closeRef}
            onClose={onClose}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function CardDetail({
  card,
  board,
  columns,
  sprints,
  labels,
  closeRef,
  onClose,
}: {
  card: Card
  board: Board
  columns: Column[]
  sprints: Sprint[]
  labels: Label[]
  closeRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
}) {
  const column = columns.find((c) => c.id === card.column_id)
  const key = cardKey(board.key, card.number)

  return (
    <>
      <SheetHeader className="flex-row items-center gap-2 border-b px-6 py-3">
        <SheetDescription className="font-mono">{key}</SheetDescription>
        <span className="text-sm text-muted-foreground">
          · {board.name} / {column?.name}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <DeleteCard card={card} cardKey={key} onDeleted={onClose} />
          <Button
            ref={closeRef}
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            onClick={onClose}
          >
            <XIcon />
          </Button>
        </div>
      </SheetHeader>

      <div className="flex flex-col gap-6 overflow-y-auto px-6 py-6">
        <TitleEditor card={card} />

        <dl className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 text-sm">
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <Select
              value={card.column_id}
              onValueChange={(id) => {
                const to = columns.find((c) => c.id === id)
                if (!to || !column || to.id === column.id) return
                const siblings = cardsCollection.toArray
                  .filter((c) => c.column_id === to.id)
                  .map((c) => c.position)
                  .sort((a, b) => a - b)
                moveCard(card, column, to, positionAfterLast(siblings)).isPersisted.promise.catch(
                  reportFailure('Move not saved'),
                )
              }}
            >
              <SelectTrigger size="sm" aria-label="Status">
                <SelectValue>{() => column?.name}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {columns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </dd>

          <dt className="text-muted-foreground">Sprint</dt>
          <dd>
            <SprintSelect card={card} sprints={sprints} />
          </dd>

          <dt className="text-muted-foreground">Priority</dt>
          <dd>
            <Select
              value={card.priority}
              onValueChange={(p: Priority | null) =>
                p &&
                updateCard(card.id, 'Priority not saved', (d) => {
                  d.priority = p
                })
              }
            >
              <SelectTrigger size="sm" aria-label="Priority">
                <SelectValue>{(p: Priority) => priorityNames[p]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {priorities.map((p) => (
                    <SelectItem key={p} value={p}>
                      {priorityNames[p]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </dd>

          <dt className="text-muted-foreground">Due</dt>
          <dd>
            <DueDatePicker card={card} done={column?.is_done ?? false} />
          </dd>

          <dt className="text-muted-foreground">Labels</dt>
          <dd>
            <LabelPicker card={card} boardId={board.id} labels={labels} />
          </dd>
        </dl>

        <Separator />
        <DescriptionEditor card={card} />
        <Separator />
        <CardChecklist cardId={card.id} />
        <Separator />
        <CardActivity card={card} />
      </div>
    </>
  )
}

function TitleEditor({ card }: { card: Card }) {
  const [title, setTitle] = useState(card.title)
  // Follow edits that arrive from elsewhere (another tab, a refetch).
  const [seen, setSeen] = useState(card.title)
  if (seen !== card.title) {
    setSeen(card.title)
    setTitle(card.title)
  }

  function save() {
    const trimmed = title.trim()
    if (!trimmed) {
      setTitle(card.title)
      return
    }
    if (trimmed !== card.title) {
      updateCard(card.id, 'Title not saved', (d) => {
        d.title = trimmed
      })
    }
  }

  return (
    <SheetTitle render={<div />}>
      <Textarea
        aria-label="Title"
        rows={1}
        className="min-h-0 resize-none border-transparent px-0 text-xl leading-7 font-semibold shadow-none focus-visible:border-input focus-visible:px-2 md:text-xl dark:bg-transparent"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          }
          if (e.key === 'Escape') setTitle(card.title)
        }}
      />
    </SheetTitle>
  )
}

function SprintSelect({ card, sprints }: { card: Card; sprints: Sprint[] }) {
  const choices = sprints.filter((s) => s.state !== 'closed' || s.id === card.sprint_id)
  return (
    <Select
      value={card.sprint_id ?? 'backlog'}
      onValueChange={(value) =>
        updateCard(card.id, 'Sprint not saved', (d) => {
          d.sprint_id = value === 'backlog' || !value ? null : value
        })
      }
    >
      <SelectTrigger size="sm" aria-label="Sprint">
        <SelectValue>
          {(value: string) => {
            const sprint = sprints.find((s) => s.id === value)
            return sprint
              ? `${sprint.name} · ${sprintRange(sprint.starts_on, sprint.ends_on)}`
              : 'Backlog (no sprint)'
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="backlog">Backlog (no sprint)</SelectItem>
          {choices.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name} · {sprintRange(s.starts_on, s.ends_on)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function DueDatePicker({ card, done }: { card: Card; done: boolean }) {
  const [open, setOpen] = useState(false)
  const due = card.due_on ? dueInfo(card.due_on, done) : null

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="outline" size="sm" />}>
          <CalendarIcon data-icon="inline-start" />
          <span
            className={cn(
              due?.state === 'overdue' && 'text-destructive',
              !due && 'text-muted-foreground',
            )}
          >
            {due?.label ?? 'No due date'}
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={card.due_on ? parseISO(card.due_on) : undefined}
            onSelect={(date) => {
              updateCard(card.id, 'Due date not saved', (d) => {
                d.due_on = date ? format(date, 'yyyy-MM-dd') : null
              })
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
      {card.due_on ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Clear due date"
          onClick={() =>
            updateCard(card.id, 'Due date not saved', (d) => {
              d.due_on = null
            })
          }
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  )
}

function DescriptionEditor({ card }: { card: Card }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(card.description)

  // Typing updates the card at once and saves 600 ms after the last keystroke.
  const save = usePacedMutations<string>({
    onMutate: (value) => {
      cardsCollection.update(card.id, (d) => {
        d.description = value
      })
    },
    mutationFn: async ({ transaction }) => {
      const changes = transaction.mutations[0]?.changes as Partial<Card> | undefined
      if (!changes) return
      const { error } = await supabase
        .from('cards')
        .update({ description: changes.description })
        .eq('id', card.id)
      if (error) throw new Error(error.message)
      await cardsCollection.utils.refetch()
    },
    strategy: debounceStrategy({ wait: 600 }),
  })

  return (
    <section aria-labelledby="description-heading" className="flex flex-col gap-2.5">
      <div className="flex items-center">
        <h2 id="description-heading" className="text-sm font-semibold">
          Description
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => {
            if (!editing) setText(card.description)
            setEditing(!editing)
          }}
        >
          {editing ? 'Done' : 'Edit'}
        </Button>
      </div>
      {editing ? (
        <Textarea
          autoFocus
          rows={8}
          aria-label="Description (Markdown)"
          placeholder="Markdown works: **bold**, `code`, - lists…"
          className="font-mono text-sm"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            save(e.target.value)
          }}
        />
      ) : card.description.trim() ? (
        <div className="prose-doit text-sm leading-6">
          <Markdown>{card.description}</Markdown>
        </div>
      ) : (
        <Button
          variant="ghost"
          className="justify-start text-muted-foreground"
          onClick={() => setEditing(true)}
        >
          Add a description…
        </Button>
      )}
    </section>
  )
}

function DeleteCard({
  card,
  cardKey,
  onDeleted,
}: {
  card: Card
  cardKey: string
  onDeleted: () => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="Delete card" />}
      >
        <Trash2Icon />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {cardKey}?</AlertDialogTitle>
          <AlertDialogDescription>
            “{card.title}” and its checklist and activity are deleted for good.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onDeleted()
              cardsCollection
                .delete(card.id)
                .isPersisted.promise.catch(reportFailure('Card not deleted'))
            }}
          >
            Delete card
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
