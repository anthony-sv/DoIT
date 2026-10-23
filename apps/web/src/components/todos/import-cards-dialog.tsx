import { useMemo, useState } from 'react'
import { eq, isNull, not, useLiveQuery } from '@tanstack/react-db'
import { ImportIcon, UserRoundCheckIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/toast'
import { importCardsAsTodos } from '@/data/actions'
import {
  boardsCollection,
  cardsCollection,
  columnsCollection,
  todosCollection,
} from '@/data/collections'
import type { TodoSection } from '@/data/schemas'
import { currentUserId } from '@/lib/auth'
import { colorClasses } from '@/lib/colors'
import { dueInfo } from '@/lib/format'
import { type AssignedCard, INBOX, assignedCards, cardsToImport } from '@/lib/todos'
import { cn } from '@/lib/utils'
import { DueChip } from './todo-row'

function reportFailure(what: string) {
  return (error: Error) => toast.add({ title: what, description: error.message, type: 'error' })
}

/** The todos page's "Import assigned cards" button and its dialog. */
export function ImportCardsDialog({ sections }: { sections: TodoSection[] }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <ImportIcon data-icon="inline-start" />
        Import assigned cards
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {/* Mounts with each opening, so the selection starts over. */}
        <ImportCards sections={sections} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ImportCards({ sections, onDone }: { sections: TodoSection[]; onDone: () => void }) {
  const you = currentUserId()
  const { data: cards } = useLiveQuery({
    query: (q) => q.from({ card: cardsCollection }).where(({ card }) => eq(card.assignee_id, you)),
  })
  const { data: boards } = useLiveQuery({
    query: (q) => q.from({ board: boardsCollection }),
  })
  const { data: doneColumns } = useLiveQuery({
    query: (q) =>
      q.from({ column: columnsCollection }).where(({ column }) => eq(column.is_done, true)),
  })
  const { data: linked } = useLiveQuery({
    query: (q) =>
      q
        .from({ todo: todosCollection })
        .where(({ todo }) => not(isNull(todo.card_id)))
        .select(({ todo }) => ({ card_id: todo.card_id })),
  })
  const groups = useMemo(
    () => assignedCards({ userId: you, boards, columns: doneColumns, cards, todos: linked }),
    [you, boards, doneColumns, cards, linked],
  )

  // What the user unticked; everything else not in their todos yet is picked.
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => new Set())
  const [listId, setListId] = useState(INBOX)
  const chosen = cardsToImport(groups, skipped)
  const importable = groups.flatMap((g) => g.cards.filter((c) => !c.imported))
  const allChosen = chosen.length === importable.length
  // A section deleted while the dialog is open sends them to the inbox.
  const sectionId = sections.find((s) => s.id === listId)?.id ?? null

  function pick(cardId: string, on: boolean) {
    setSkipped((ids) => {
      const next = new Set(ids)
      if (on) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  }

  function submit() {
    if (chosen.length === 0) return
    importCardsAsTodos(chosen, sectionId).isPersisted.promise.catch(
      reportFailure('Todos not imported'),
    )
    onDone()
  }

  const header = (
    <DialogHeader>
      <DialogTitle>Import assigned cards</DialogTitle>
      <DialogDescription>
        Each card becomes a todo with its key, title and due date.
      </DialogDescription>
    </DialogHeader>
  )

  if (groups.length === 0) {
    return (
      <>
        {header}
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserRoundCheckIcon />
            </EmptyMedia>
            <EmptyTitle>Nothing assigned to you</EmptyTitle>
            <EmptyDescription>
              Cards assigned to you on any board show up here, until they’re done.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </>
    )
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {header}
      <div className="flex min-h-7 items-center justify-between gap-2 text-sm text-muted-foreground">
        {importable.length === 0 ? (
          'They’re all in your todos already.'
        ) : (
          <>
            <span>
              {chosen.length} of {importable.length} selected
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setSkipped(allChosen ? new Set(importable.map((c) => c.card.id)) : new Set())
              }
            >
              {allChosen ? 'Select none' : 'Select all'}
            </Button>
          </>
        )}
      </div>
      {/* The viewport takes the cap too, so a long list scrolls inside it. */}
      <ScrollArea className="-mx-4 max-h-[min(24rem,50svh)] *:data-[slot=scroll-area-viewport]:max-h-[inherit]">
        <FieldGroup className="gap-6 px-4 py-1">
          {groups.map(({ board, cards }) => (
            // A fieldset is at least as wide as its content; min-w-0 lets long titles wrap.
            <FieldSet key={board.id} className="min-w-0 gap-2">
              <FieldLegend variant="label" className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn('size-2 shrink-0 rounded-[2px]', colorClasses[board.color].dot)}
                />
                {board.name}
              </FieldLegend>
              <FieldGroup className="gap-3">
                {cards.map((item) => (
                  <CardOption
                    key={item.card.id}
                    item={item}
                    checked={!skipped.has(item.card.id)}
                    onCheckedChange={(on) => pick(item.card.id, on)}
                  />
                ))}
              </FieldGroup>
            </FieldSet>
          ))}
        </FieldGroup>
      </ScrollArea>
      <Field orientation="horizontal">
        <FieldLabel id="import-cards-to">Add to</FieldLabel>
        <Select value={listId} onValueChange={(value) => setListId(value ?? INBOX)}>
          <SelectTrigger aria-labelledby="import-cards-to" className="min-w-40">
            <SelectValue>
              {(value: string) => sections.find((s) => s.id === value)?.name ?? 'Inbox'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value={INBOX}>Inbox</SelectItem>
              {sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" disabled={chosen.length === 0}>
          Import {chosen.length} {chosen.length === 1 ? 'card' : 'cards'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** One card's row: ticked and locked once it is in the user's todos. */
function CardOption({
  item: { card, key, imported },
  checked,
  onCheckedChange,
}: {
  item: AssignedCard
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const id = `import-card-${card.id}`
  // Cards in a done column aren't listed, so none of these is done.
  const due = card.due_on ? dueInfo(card.due_on, false) : null

  return (
    <Field orientation="horizontal" data-disabled={imported || undefined}>
      <Checkbox
        id={id}
        checked={imported || checked}
        disabled={imported}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      {/* The badge and due chip go under the title: beside it they'd leave
          the title a few characters wide on a phone. */}
      <FieldContent className="min-w-0">
        {/* Full width, so a long word breaks instead of overflowing. */}
        <FieldLabel htmlFor={id} className="w-full items-baseline font-normal">
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{key}</span>
          <span className="min-w-0 wrap-break-word">{card.title}</span>
        </FieldLabel>
        {imported || due ? (
          <div className="flex flex-wrap items-center gap-1">
            {imported ? <Badge variant="secondary">In your todos</Badge> : null}
            {due ? <DueChip due={due} /> : null}
          </div>
        ) : null}
      </FieldContent>
    </Field>
  )
}
