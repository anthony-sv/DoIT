import { useMemo } from 'react'
import { Link, getRouteApi } from '@tanstack/react-router'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { ArchiveIcon, InboxIcon, SearchIcon } from 'lucide-react'
import { CardSheet } from '@/components/card/card-sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
} from '@/components/ui/select'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  boardsCollection,
  cardsCollection,
  checklistItemsCollection,
  columnsCollection,
  labelsCollection,
  sprintsCollection,
} from '@/data/collections'
import type { Card, Sprint } from '@/data/schemas'
import { currentUserId } from '@/lib/auth'
import { daysUntil, sprintRange } from '@/lib/format'
import { BoardGone } from './board-gone'
import { BoardColumns } from './board-columns'
import { BoardMenu } from './board-menu'
import { ShareBoardButton } from './share-board-dialog'

const route = getRouteApi('/_app/b/$boardId/')

export type ChecklistProgress = Map<string, { done: number; total: number }>

export function BoardView({ boardId }: { boardId: string }) {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  const { data: board } = useLiveQuery({
    query: (q) =>
      q
        .from({ board: boardsCollection })
        .where(({ board }) => eq(board.id, boardId))
        .findOne(),
  })
  const { data: columns } = useLiveQuery({
    query: (q) =>
      q
        .from({ column: columnsCollection })
        .where(({ column }) => eq(column.board_id, boardId))
        .orderBy(({ column }) => column.position),
  })
  const { data: sprints } = useLiveQuery({
    query: (q) =>
      q
        .from({ sprint: sprintsCollection })
        .where(({ sprint }) => eq(sprint.board_id, boardId))
        .orderBy(({ sprint }) => sprint.starts_on),
  })
  const { data: labels } = useLiveQuery({
    query: (q) =>
      q.from({ label: labelsCollection }).where(({ label }) => eq(label.board_id, boardId)),
  })
  const { data: cards } = useLiveQuery({
    query: (q) =>
      q
        .from({ card: cardsCollection })
        .where(({ card }) => eq(card.board_id, boardId))
        .orderBy(({ card }) => card.position),
  })
  const { data: checklist } = useLiveQuery({
    query: (q) =>
      q
        .from({ item: checklistItemsCollection })
        .innerJoin({ card: cardsCollection }, ({ item, card }) => eq(item.card_id, card.id))
        .where(({ card }) => eq(card.board_id, boardId))
        .select(({ item }) => ({ card_id: item.card_id, done: item.done })),
  })

  const activeSprint = sprints.find((s) => s.state === 'active')
  const sprintFilter = search.sprint ?? activeSprint?.id ?? 'all'
  const shownSprint = sprints.find((s) => s.id === sprintFilter)

  const visibleCards = useMemo(() => {
    const closed = new Set(sprints.filter((s) => s.state === 'closed').map((s) => s.id))
    const needle = search.q?.trim().toLowerCase()
    return cards.filter((card) => {
      if (sprintFilter === 'all') {
        if (card.sprint_id && closed.has(card.sprint_id)) return false
      } else if (card.sprint_id !== sprintFilter) return false
      if (needle) {
        const key = `${board?.key}-${card.number}`.toLowerCase()
        if (!card.title.toLowerCase().includes(needle) && !key.includes(needle)) return false
      }
      return true
    })
  }, [cards, sprints, sprintFilter, search.q, board?.key])

  const progress: ChecklistProgress = useMemo(() => {
    const map: ChecklistProgress = new Map()
    for (const item of checklist) {
      const entry = map.get(item.card_id) ?? { done: 0, total: 0 }
      entry.total += 1
      if (item.done) entry.done += 1
      map.set(item.card_id, entry)
    }
    return map
  }, [checklist])

  const openCard = search.card ? cards.find((c) => c.id === search.card) : undefined

  if (!board) return <BoardGone />

  return (
    <div className="flex min-h-svh flex-col gap-5 px-4 py-5 sm:px-7">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <SidebarTrigger className="-ml-1.5 md:hidden" />
            {board.owner_id === currentUserId() ? 'Boards' : 'Shared with me'} / {board.name}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{board.name}</h1>
            {board.archived_at ? (
              <Badge variant="secondary">
                <ArchiveIcon data-icon="inline-start" />
                Archived
              </Badge>
            ) : null}
            <SprintPicker
              sprints={sprints}
              value={sprintFilter}
              onChange={(sprint) =>
                void navigate({ search: (prev) => ({ ...prev, sprint }), replace: true })
              }
            />
          </div>
          <SprintProgress sprint={shownSprint} cards={visibleCards} columns={columns} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="w-56">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Filter cards"
              aria-label="Filter cards"
              value={search.q ?? ''}
              onChange={(e) =>
                void navigate({
                  search: (prev) => ({ ...prev, q: e.target.value || undefined }),
                  replace: true,
                })
              }
            />
          </InputGroup>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to="/b/$boardId/plan" params={{ boardId }} />}
          >
            <InboxIcon data-icon="inline-start" />
            Backlog &amp; sprints
          </Button>
          <ShareBoardButton board={board} />
          <BoardMenu board={board} />
        </div>
      </header>

      <BoardColumns
        board={board}
        columns={columns}
        cards={visibleCards}
        labels={labels}
        progress={progress}
        sprintId={shownSprint?.state === 'closed' ? null : (shownSprint?.id ?? null)}
        onOpenCard={(id) => void navigate({ search: (prev) => ({ ...prev, card: id }) })}
      />

      <CardSheet
        card={openCard}
        board={board}
        columns={columns}
        sprints={sprints}
        labels={labels}
        onClose={() => void navigate({ search: (prev) => ({ ...prev, card: undefined }) })}
      />
    </div>
  )
}

function SprintPicker({
  sprints,
  value,
  onChange,
}: {
  sprints: Sprint[]
  value: string
  onChange: (value: string) => void
}) {
  if (sprints.length === 0) return null
  const current = sprints.find((s) => s.id === value)
  const open = sprints.filter((s) => s.state !== 'closed')
  const closed = sprints.filter((s) => s.state === 'closed').reverse()

  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger size="sm" aria-label="Sprint shown on the board">
        {current ? (
          <>
            <SprintDot state={current.state} />
            {current.name} · {sprintRange(current.starts_on, current.ends_on)}
          </>
        ) : (
          'All cards'
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="all">All cards</SelectItem>
          {open.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              <SprintDot state={s.state} />
              {s.name} · {sprintRange(s.starts_on, s.ends_on)}
            </SelectItem>
          ))}
        </SelectGroup>
        {closed.length > 0 ? (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Closed</SelectLabel>
              {closed.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} · {sprintRange(s.starts_on, s.ends_on)}
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        ) : null}
      </SelectContent>
    </Select>
  )
}

export function SprintDot({ state }: { state: Sprint['state'] }) {
  if (state !== 'active') return null
  return <span className="size-1.5 rounded-full bg-label-green-foreground" aria-label="Active" />
}

function SprintProgress({
  sprint,
  cards,
  columns,
}: {
  sprint: Sprint | undefined
  cards: Card[]
  columns: { id: string; is_done: boolean }[]
}) {
  if (!sprint || cards.length === 0) return null
  const doneColumns = new Set(columns.filter((c) => c.is_done).map((c) => c.id))
  const done = cards.filter((c) => doneColumns.has(c.column_id)).length
  const daysLeft = daysUntil(sprint.ends_on)
  const left =
    sprint.state === 'closed'
      ? 'closed'
      : daysLeft < 0
        ? 'past its end date'
        : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`

  return (
    <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
      <Progress
        value={(done / cards.length) * 100}
        className="w-40"
        aria-label="Sprint progress"
      />
      <span>
        {done} of {cards.length} done · {left}
      </span>
    </div>
  )
}
