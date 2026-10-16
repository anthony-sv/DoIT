import { useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link } from '@tanstack/react-router'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { DragDropProvider, KeyboardSensor, PointerSensor, useDroppable } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import { CollisionPriority } from '@dnd-kit/abstract'
import { GripVerticalIcon, PlusIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card as Panel, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { toast } from '@/components/ui/toast'
import {
  boardsCollection,
  cardsCollection,
  columnsCollection,
  labelsCollection,
  sprintsCollection,
} from '@/data/collections'
import { nextSprint, startSprint } from '@/data/actions'
import type { Board, Card, Label, Sprint } from '@/data/schemas'
import { colorClasses } from '@/lib/colors'
import { cardKey, daysUntil, priorityNames, sprintRange } from '@/lib/format'
import { positionBetween, withItemAt } from '@/lib/position'
import { cn } from '@/lib/utils'
import { Burndown } from './burndown'
import { CloseSprintDialog } from './close-sprint-dialog'
import { SprintDetails } from './sprint-details'

const BACKLOG = 'backlog'

const sensors = [
  PointerSensor,
  KeyboardSensor.configure({
    keyboardCodes: {
      start: ['Space'],
      cancel: ['Escape'],
      end: ['Space', 'Tab'],
      up: ['ArrowUp'],
      down: ['ArrowDown'],
      left: ['ArrowLeft'],
      right: ['ArrowRight'],
    },
  }),
]

function reportFailure(what: string) {
  return (error: Error) => toast.add({ title: what, description: error.message, type: 'error' })
}

export function PlanView({ boardId }: { boardId: string }) {
  const { data: board } = useLiveQuery({
    query: (q) =>
      q
        .from({ board: boardsCollection })
        .where(({ board }) => eq(board.id, boardId))
        .findOne(),
  })
  const { data: sprints } = useLiveQuery({
    query: (q) =>
      q
        .from({ sprint: sprintsCollection })
        .where(({ sprint }) => eq(sprint.board_id, boardId))
        .orderBy(({ sprint }) => sprint.starts_on),
  })
  const { data: cards } = useLiveQuery({
    query: (q) =>
      q
        .from({ card: cardsCollection })
        .where(({ card }) => eq(card.board_id, boardId))
        .orderBy(({ card }) => card.backlog_position),
  })
  const { data: columns } = useLiveQuery({
    query: (q) =>
      q.from({ column: columnsCollection }).where(({ column }) => eq(column.board_id, boardId)),
  })
  const { data: labels } = useLiveQuery({
    query: (q) =>
      q.from({ label: labelsCollection }).where(({ label }) => eq(label.board_id, boardId)),
  })

  const doneColumns = useMemo(
    () => new Set(columns.filter((c) => c.is_done).map((c) => c.id)),
    [columns],
  )
  const isDone = (card: Card) => doneColumns.has(card.column_id)

  const active = sprints.find((s) => s.state === 'active')
  const planned = sprints.find((s) => s.state === 'planned')
  const closed = sprints.filter((s) => s.state === 'closed').reverse()
  const activeCards = active ? cards.filter((c) => c.sprint_id === active.id) : []

  if (!board) return null

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[1320px] flex-col gap-5 px-4 py-5 sm:px-7">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <SidebarTrigger className="-ml-1.5 md:hidden" />
            <Link to="/b/$boardId" params={{ boardId }} className="hover:text-foreground">
              {board.name}
            </Link>
            / Backlog &amp; sprints
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {planned ? `Plan ${planned.name}` : 'Backlog & sprints'}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {active ? (
            <CloseSprintDialog
              sprint={active}
              unfinished={activeCards.filter((c) => !isDone(c))}
              next={planned ?? null}
            />
          ) : null}
          {planned && !active ? (
            <Button
              onClick={() =>
                startSprint(planned).isPersisted.promise.catch(reportFailure('Sprint not started'))
              }
            >
              Start {planned.name}
            </Button>
          ) : null}
        </div>
      </header>

      {active ? (
        <ActiveSprint sprint={active} cards={activeCards} isDone={isDone} />
      ) : null}

      <PlanningLists
        board={board}
        cards={cards}
        sprints={sprints}
        planned={planned}
        labels={labels}
        isDone={isDone}
      />

      {closed.length > 0 ? (
        <Panel>
          <CardHeader>
            <CardTitle>Closed sprints</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {closed.map((s) => {
                const sprintCards = cards.filter((c) => c.sprint_id === s.id)
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                    <Link
                      to="/b/$boardId"
                      params={{ boardId }}
                      search={{ sprint: s.id }}
                      className="font-medium hover:underline"
                    >
                      {s.name}
                    </Link>
                    <span className="text-muted-foreground">{sprintRange(s.starts_on, s.ends_on)}</span>
                    {s.goal ? <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.goal}</span> : null}
                    <span className="ml-auto text-muted-foreground">
                      {sprintCards.filter(isDone).length} done
                    </span>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Panel>
      ) : null}
    </div>
  )
}

function ActiveSprint({
  sprint,
  cards,
  isDone,
}: {
  sprint: Sprint
  cards: Card[]
  isDone: (card: Card) => boolean
}) {
  const done = cards.filter(isDone).length
  const today = new Date().toISOString().slice(0, 10)
  const overdue = cards.filter((c) => !isDone(c) && c.due_on && c.due_on < today).length
  const daysLeft = Math.max(0, daysUntil(sprint.ends_on))

  return (
    <section
      aria-label={`${sprint.name} progress`}
      className="flex flex-wrap items-center gap-6 rounded-xl border bg-card p-5 text-card-foreground"
    >
      <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
        <Badge variant="secondary" className="bg-label-green text-label-green-foreground">
          Active
        </Badge>
        <div className="text-lg font-semibold">
          {sprint.name} · {sprintRange(sprint.starts_on, sprint.ends_on)}
        </div>
        {sprint.goal ? (
          <p className="text-sm text-muted-foreground">Goal: {sprint.goal}</p>
        ) : null}
      </div>
      <dl className="flex flex-wrap gap-7">
        <Stat value={`${done}`} suffix={` / ${cards.length}`} label="cards done" />
        <Stat value={`${daysLeft}`} label={daysLeft === 1 ? 'day left' : 'days left'} />
        <Stat value={`${overdue}`} label="overdue" warn={overdue > 0} />
      </dl>
      <div className="min-w-0 flex-[1_1_340px]">
        {cards.length > 0 ? (
          <Burndown sprint={sprint} cards={cards.map((c) => (isDone(c) ? c : { ...c, completed_at: null }))} />
        ) : (
          <p className="text-sm text-muted-foreground">No cards in this sprint yet.</p>
        )}
      </div>
    </section>
  )
}

function Stat({
  value,
  suffix,
  label,
  warn,
}: {
  value: string
  suffix?: string
  label: string
  warn?: boolean
}) {
  return (
    <div className="flex flex-col-reverse gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('text-2xl font-bold', warn && 'text-destructive')}>
        {value}
        {suffix ? <span className="text-sm font-medium text-muted-foreground">{suffix}</span> : null}
      </dd>
    </div>
  )
}

type Lists = Record<string, string[]>

function PlanningLists({
  board,
  cards,
  sprints,
  planned,
  labels,
  isDone,
}: {
  board: Board
  cards: Card[]
  sprints: Sprint[]
  planned: Sprint | undefined
  labels: Label[]
  isDone: (card: Card) => boolean
}) {
  const derived = useMemo(() => {
    const lists: Lists = { [BACKLOG]: [] }
    if (planned) lists[planned.id] = []
    for (const card of cards) {
      if (card.sprint_id === null && !isDone(card)) lists[BACKLOG]!.push(card.id)
      else if (planned && card.sprint_id === planned.id) lists[planned.id]!.push(card.id)
    }
    return lists
  }, [cards, planned, isDone])

  // dnd-kit moves the rows in the DOM while dragging; after a drop the lists
  // remount so React never reconciles those moved nodes (see board-columns).
  const [generation, setGeneration] = useState(0)
  const lists = derived
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const labelsById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels])

  function drop(cardId: string, final: Lists) {
    const card = byId.get(cardId)
    const listId = Object.keys(final).find((k) => final[k]!.includes(cardId))
    if (!card || !listId) return
    const list = final[listId]!
    const index = list.indexOf(cardId)
    const before = byId.get(list[index - 1] ?? '')?.backlog_position
    const after = byId.get(list[index + 1] ?? '')?.backlog_position
    const sprintId = listId === BACKLOG ? null : listId
    if (
      card.sprint_id === sprintId &&
      (before === undefined || before < card.backlog_position) &&
      (after === undefined || after > card.backlog_position)
    ) {
      return
    }
    cardsCollection
      .update(card.id, (d) => {
        d.sprint_id = sprintId
        d.backlog_position = positionBetween(before, after)
      })
      .isPersisted.promise.catch(reportFailure('Plan not saved'))
  }

  return (
    <DragDropProvider
      sensors={sensors}
      onDragEnd={(event) => {
        const { source, target } = event.operation
        if (event.canceled || !isSortable(source)) return
        const id = String(source.id)
        flushSync(() => setGeneration((g) => g + 1))
        // Dropped on a list's empty space: append. Otherwise dnd-kit has
        // already slotted the row among the others.
        const onList = target?.type === 'list' ? String(target.id) : null
        const listId = onList ?? String(source.sortable.group)
        const list = derived[listId]
        if (!list) return
        const index = onList ? list.length : source.sortable.index
        drop(id, withItemAt(derived, listId, id, index))
      }}
    >
      <div key={generation} className="flex flex-wrap items-start gap-5">
        <Panel className="min-w-0 flex-[1_1_520px] gap-0 py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>Backlog</CardTitle>
            <CardAction className="text-sm text-muted-foreground">
              {lists[BACKLOG]!.length} cards
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            <PlanList
              id={BACKLOG}
              ids={lists[BACKLOG]!}
              byId={byId}
              labelsById={labelsById}
              board={board}
              empty="Nothing waiting. New cards land here until you put them in a sprint."
            />
          </CardContent>
        </Panel>

        {planned ? (
          <Panel className="min-w-0 flex-[1_1_420px]">
            <CardHeader>
              <CardTitle>{planned.name}</CardTitle>
              <CardAction className="text-sm text-muted-foreground">
                {lists[planned.id]!.length} committed
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <SprintDetails sprint={planned} />
              <PlanList
                id={planned.id}
                ids={lists[planned.id]!}
                byId={byId}
                labelsById={labelsById}
                board={board}
                bordered
                empty="Drag cards here from the backlog."
              />
            </CardContent>
          </Panel>
        ) : (
          <Panel className="min-w-0 flex-[1_1_420px]">
            <CardContent>
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No sprint planned</EmptyTitle>
                  <EmptyDescription>
                    Create the next sprint, then drag cards into it from the backlog.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    onClick={() =>
                      sprintsCollection
                        .insert(nextSprint(board, sprints))
                        .isPersisted.promise.catch(reportFailure('Sprint not created'))
                    }
                  >
                    <PlusIcon data-icon="inline-start" />
                    Create Sprint {sprints.length + 1}
                  </Button>
                </EmptyContent>
              </Empty>
            </CardContent>
          </Panel>
        )}
      </div>
    </DragDropProvider>
  )
}

function PlanList({
  id,
  ids,
  byId,
  labelsById,
  board,
  bordered,
  empty,
}: {
  id: string
  ids: string[]
  byId: Map<string, Card>
  labelsById: Map<string, Label>
  board: Board
  bordered?: boolean
  empty: string
}) {
  const { ref, isDropTarget } = useDroppable({
    id,
    type: 'list',
    accept: 'card',
    collisionPriority: CollisionPriority.Lowest,
  })

  return (
    <ul
      ref={ref}
      className={cn(
        'flex min-h-16 flex-col',
        bordered && 'gap-2',
        isDropTarget && 'rounded-lg bg-accent/50',
      )}
    >
      {ids.map((cardId, index) => {
        const card = byId.get(cardId)
        if (!card) return null
        return (
          <PlanRow
            key={cardId}
            index={index}
            listId={id}
            card={card}
            labels={card.label_ids.map((l) => labelsById.get(l)).filter((l) => l !== undefined)}
            board={board}
            bordered={bordered}
          />
        )
      })}
      {ids.length === 0 ? (
        <li
          className={cn(
            'flex min-h-14 items-center justify-center rounded-lg border-[1.5px] border-dashed px-4 text-center text-sm text-muted-foreground',
            !bordered && 'm-4',
          )}
        >
          {empty}
        </li>
      ) : null}
    </ul>
  )
}

function PlanRow({
  index,
  listId,
  card,
  labels,
  board,
  bordered,
}: {
  index: number
  listId: string
  card: Card
  labels: Label[]
  board: Board
  bordered?: boolean
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id: card.id,
    index,
    group: listId,
    type: 'card',
    accept: 'card',
  })
  const urgent = card.priority === 'high' || card.priority === 'urgent'

  return (
    <li
      ref={ref}
      className={cn(
        'flex items-center gap-3 bg-card px-4 py-2.5',
        bordered ? 'rounded-[10px] border' : 'border-b last:border-b-0',
        isDragging && 'relative z-10 rounded-[10px] shadow-lg ring-2 ring-primary',
      )}
    >
      <button
        ref={handleRef}
        type="button"
        aria-label={`Move ${cardKey(board.key, card.number)}`}
        className="cursor-grab rounded text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
        {cardKey(board.key, card.number)}
      </span>
      <Link
        to="/b/$boardId"
        params={{ boardId: board.id }}
        search={{ card: card.id }}
        className="min-w-0 flex-1 truncate text-sm hover:underline"
      >
        {card.title}
      </Link>
      {labels.slice(0, 2).map((l) => (
        <Badge key={l.id} variant="secondary" className={cn('max-sm:hidden', colorClasses[l.color].chip)}>
          {l.name}
        </Badge>
      ))}
      <span
        className={cn(
          'w-14 shrink-0 text-right text-xs',
          urgent ? 'font-semibold text-destructive' : 'text-muted-foreground',
        )}
      >
        {priorityNames[card.priority]}
      </span>
    </li>
  )
}
