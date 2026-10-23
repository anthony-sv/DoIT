import { useCallback, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link } from '@tanstack/react-router'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { DragDropProvider, KeyboardSensor, PointerSensor } from '@dnd-kit/react'
import { isSortable } from '@dnd-kit/react/sortable'
import { PlusIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card as Panel, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { toast } from '@/components/ui/toast'
import { BoardGone } from '@/components/board/board-gone'
import {
  boardsCollection,
  cardsCollection,
  columnsCollection,
  labelsCollection,
  sprintsCollection,
} from '@/data/collections'
import { nextSprint } from '@/data/actions'
import type { Board, Card, Label, Sprint } from '@/data/schemas'
import { useEmails } from '@/hooks/use-board-people'
import { daysLabel, daysUntil, dueInfo, sprintRange } from '@/lib/format'
import { positionBetween, withItemAt } from '@/lib/position'
import { nextSprintName } from '@/lib/sprints'
import { cn } from '@/lib/utils'
import { Burndown } from './burndown'
import { CloseSprintDialog } from './close-sprint-dialog'
import { PlanList } from './plan-list'
import { BACKLOG, type Lists, cardsLabel, planningLists, totalEstimate } from './planning'
import { SprintMenu } from './sprint-menu'
import { SprintPanel } from './sprint-panel'

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
        .orderBy(({ sprint }) => sprint.starts_on)
        // Sprints that start the same day keep the order they were planned in.
        .orderBy(({ sprint }) => sprint.created_at),
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
  const isDone = useCallback((card: Card) => doneColumns.has(card.column_id), [doneColumns])

  const active = sprints.find((s) => s.state === 'active')
  const planned = sprints.filter((s) => s.state === 'planned')
  const closed = sprints.filter((s) => s.state === 'closed').reverse()
  const activeCards = active ? cards.filter((c) => c.sprint_id === active.id) : []

  if (!board) return <BoardGone />

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
          <h1 className="text-2xl font-bold tracking-tight">Backlog &amp; sprints</h1>
        </div>
        {active ? (
          <CloseSprintDialog
            sprint={active}
            unfinished={activeCards.filter((c) => !isDone(c))}
            planned={planned}
          />
        ) : null}
      </header>

      {active ? (
        <ActiveSprint sprint={active} cards={activeCards} isDone={isDone} />
      ) : null}

      <PlanningLists
        board={board}
        cards={cards}
        sprints={sprints}
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
                  <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5 text-sm">
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
                    <div className="ml-auto flex items-center gap-2 text-muted-foreground">
                      {sprintCards.filter(isDone).length} done
                      <SprintMenu sprint={s} cardCount={sprintCards.length} />
                    </div>
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
  // Same rule as the cards' due chips, so by the local day, not the UTC one.
  const overdue = cards.filter((c) => c.due_on && dueInfo(c.due_on, isDone(c)).state === 'overdue').length
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

/** The backlog beside a stack of sprints (active first), with cards dragged between them. */
function PlanningLists({
  board,
  cards,
  sprints,
  labels,
  isDone,
}: {
  board: Board
  cards: Card[]
  sprints: Sprint[]
  labels: Label[]
  isDone: (card: Card) => boolean
}) {
  const open = useMemo(
    () => [
      ...sprints.filter((s) => s.state === 'active'),
      ...sprints.filter((s) => s.state === 'planned'),
    ],
    [sprints],
  )
  const running = open.find((s) => s.state === 'active')
  const lists = useMemo(
    () => planningLists(cards, open.map((s) => s.id), isDone),
    [cards, open, isDone],
  )

  // dnd-kit moves rows in the DOM while dragging; after a drop or a cancel the
  // lists remount so React never reconciles the moved nodes (see board-columns).
  const [generation, setGeneration] = useState(0)
  // Sprints showing their details editor. Lives out here so a drop's remount
  // keeps it; a sprint planned with the button below starts with it open.
  const [editing, setEditing] = useState<ReadonlySet<string>>(() => new Set())
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const labelsById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels])
  const emails = useEmails()
  const backlogEstimate = totalEstimate(lists[BACKLOG]!, byId)

  function setEditingOf(sprintId: string, on: boolean) {
    setEditing((prev) => {
      const next = new Set(prev)
      if (on) next.add(sprintId)
      else next.delete(sprintId)
      return next
    })
  }

  function planSprint() {
    const sprint = nextSprint(board, sprints)
    setEditingOf(sprint.id, true)
    sprintsCollection.insert(sprint).isPersisted.promise.catch(reportFailure('Sprint not created'))
  }

  function drop(cardId: string, final: Lists) {
    const card = byId.get(cardId)
    const listId = Object.keys(final).find((k) => final[k]!.includes(cardId))
    if (!card || !listId) return
    const list = final[listId]!
    const index = list.indexOf(cardId)
    const before = byId.get(list[index - 1] ?? '')?.backlog_position
    const after = byId.get(list[index + 1] ?? '')?.backlog_position
    const sprintId = listId === BACKLOG ? null : listId
    // A finished card would vanish in the backlog, which lists only unfinished
    // ones (planning.ts). It stays in its sprint; the remount puts the row back.
    if (sprintId === null && isDone(card)) return
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
        if (!isSortable(source)) return
        // dnd-kit moved rows in the DOM while dragging, and a cancel only undoes
        // moves within one list. Remount either way so React rebuilds from data.
        flushSync(() => setGeneration((g) => g + 1))
        if (event.canceled) return
        const id = String(source.id)
        // Dropped on a list's empty space: append. Otherwise dnd-kit has
        // already slotted the row among the others.
        const onList = target?.type === 'list' ? String(target.id) : null
        const listId = onList ?? String(source.sortable.group)
        const list = lists[listId]
        if (!list) return
        const index = onList ? list.length : source.sortable.index
        drop(id, withItemAt(lists, listId, id, index))
      }}
    >
      <div key={generation} className="flex flex-wrap items-start gap-5">
        <Panel className="min-w-0 flex-[1_1_520px] gap-0 py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>Backlog</CardTitle>
            <CardAction className="text-sm text-muted-foreground">
              {cardsLabel(lists[BACKLOG]!.length)}
              {backlogEstimate > 0 ? ` · ${daysLabel(backlogEstimate, 'long')}` : null}
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            <PlanList
              id={BACKLOG}
              ids={lists[BACKLOG]!}
              byId={byId}
              labelsById={labelsById}
              emails={emails}
              board={board}
              isDone={isDone}
              empty="Nothing waiting. New cards land here until you put them in a sprint."
            />
          </CardContent>
        </Panel>

        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5">
          {open.map((sprint) => {
            const ids = lists[sprint.id] ?? []
            return (
              <SprintPanel
                key={sprint.id}
                sprint={sprint}
                running={running}
                cardCount={ids.length}
                estimate={totalEstimate(ids, byId)}
                editing={editing.has(sprint.id)}
                onEditingChange={(on) => setEditingOf(sprint.id, on)}
              >
                <PlanList
                  id={sprint.id}
                  ids={ids}
                  byId={byId}
                  labelsById={labelsById}
                  emails={emails}
                  board={board}
                  isDone={isDone}
                  bordered
                  empty="Drag cards here from the backlog."
                />
              </SprintPanel>
            )
          })}
          <Button
            variant="outline"
            className="h-12 border-dashed bg-transparent"
            onClick={planSprint}
          >
            <PlusIcon data-icon="inline-start" />
            Plan {nextSprintName(sprints.map((s) => s.name))}
          </Button>
        </div>
      </div>
    </DragDropProvider>
  )
}
