import { type ReactNode, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { DragDropProvider, KeyboardSensor, PointerSensor, useDroppable } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import { CollisionPriority } from '@dnd-kit/abstract'
import { StickyNoteIcon } from 'lucide-react'
import type { BoardViewProps, ChecklistProgress } from '@/components/board/view-props'
import { reportFailure } from '@/components/card/card-writes'
import {
  Card as Panel,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import { cardsCollection } from '@/data/collections'
import { moveCard } from '@/data/actions'
import type { Board, Card, Column, Story } from '@/data/schemas'
import { useEmails } from '@/hooks/use-board-people'
import { colorClasses } from '@/lib/colors'
import { daysLabel } from '@/lib/format'
import { placeAt } from '@/lib/position'
import { cn } from '@/lib/utils'
import { AddTask } from './add-task'
import { NewStory } from './new-story'
import {
  type Cells,
  NO_STORY,
  cellId,
  laneOf,
  laneStats,
  laneStoryId,
  parseCellId,
  positionInCell,
  storyCells,
} from './story-cells'
import { StoryMenu } from './story-menu'
import { StoryNote } from './story-note'

// Enter opens a card; only Space picks one up with the keyboard.
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

// px. A column cell holds the largest note (200) plus its padding; four
// columns and the stories fit beside the sidebar on a 1440px screen.
const storyWidth = 208
const columnMinWidth = 216
const gap = 10

/** Stories down the side, the board's columns across, cards as sticky notes. */
export function StoryBoard({
  board,
  columns,
  cards,
  stories,
  progress,
  sprintId,
  onOpenCard,
}: BoardViewProps) {
  const [addingStory, setAddingStory] = useState(false)
  // During a drag, dnd-kit moves the DOM nodes itself and React state stays
  // put. After a drop or a cancel the lanes are remounted under a new key,
  // so React builds fresh DOM instead of reconciling nodes dnd-kit moved
  // (see board-columns.tsx).
  const [generation, setGeneration] = useState(0)

  const cells = useMemo(() => storyCells(stories, columns, cards), [stories, columns, cards])
  const storyIds = useMemo(() => new Set(stories.map((s) => s.id)), [stories])
  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const columnsById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns])
  const doneColumnIds = useMemo(
    () => new Set(columns.filter((c) => c.is_done).map((c) => c.id)),
    [columns],
  )
  const emails = useEmails()

  function laneCards(lane: string) {
    return columns
      .flatMap((column) => cells[cellId(lane, column.id)] ?? [])
      .map((id) => cardsById.get(id))
      .filter((card) => card !== undefined)
  }

  function dropCard(cardId: string, cell: string, list: string[]) {
    const card = cardsById.get(cardId)
    const target = parseCellId(cell)
    if (!card || !target) return
    const from = columnsById.get(card.column_id)
    const to = columnsById.get(target.columnId)
    if (!from || !to) return
    const index = list.indexOf(cardId)
    const before = cardsById.get(list[index - 1] ?? '')?.position
    const after = cardsById.get(list[index + 1] ?? '')?.position
    const unchanged =
      cellId(laneOf(card, storyIds), card.column_id) === cell &&
      (before === undefined || before < card.position) &&
      (after === undefined || after > card.position)
    if (unchanged) return
    // The column's other cards, hidden ones too: the new position must not
    // land on any of them.
    const column = cardsCollection.toArray
      .filter((c) => c.column_id === to.id && c.id !== card.id)
      .map((c) => c.position)
      .sort((a, b) => a - b)
    const storyId = laneStoryId(target.lane)
    moveCard(card, from, to, positionInCell(column, before, after), (draft) => {
      draft.story_id = storyId
    }).isPersisted.promise.catch(reportFailure('Move not saved'))
  }

  if (stories.length === 0 && cards.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <StickyNoteIcon />
          </EmptyMedia>
          <EmptyTitle>No stories yet</EmptyTitle>
          <EmptyDescription>
            A story groups the cards that deliver it. Its tasks show up here as sticky notes, as
            big as their estimates, and move across the columns as the work gets done.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <NewStory
            board={board}
            stories={stories}
            adding={addingStory}
            onAddingChange={setAddingStory}
            inEmpty
          />
        </EmptyContent>
      </Empty>
    )
  }

  const lane = (key: string, story: Story | null) => (
    <Lane
      key={key}
      lane={key}
      story={story}
      stories={stories}
      board={board}
      columns={columns}
      cells={cells}
      cardsById={cardsById}
      laneCards={laneCards(key)}
      doneColumnIds={doneColumnIds}
      emails={emails}
      progress={progress}
      sprintId={sprintId}
      onOpenCard={onOpenCard}
    />
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-7 sm:px-7">
        <DragDropProvider
          sensors={sensors}
          onDragEnd={(event) => {
            const { source, target } = event.operation
            if (!isSortable(source)) return
            // dnd-kit moved notes while dragging, and a cancel doesn't put back
            // a note dragged into another cell. Remount either way, swapping
            // in fresh DOM before the data change renders.
            flushSync(() => setGeneration((g) => g + 1))
            if (event.canceled) return
            const id = String(source.id)
            // Dropped on a cell's empty space (e.g. an empty cell): append.
            // Otherwise dnd-kit has already slotted it among the notes.
            const onCell = target?.type === 'cell' ? String(target.id) : null
            const cell = onCell ?? String(source.sortable.group)
            const list = cells[cell]
            if (!list) return
            dropCard(id, cell, placeAt(list, id, onCell ? list.length : source.sortable.index))
          }}
        >
          <div
            key={generation}
            className="grid gap-2.5"
            style={{
              gridTemplateColumns: `${storyWidth}px repeat(${columns.length}, minmax(${columnMinWidth}px, 1fr))`,
              minWidth: storyWidth + columns.length * (columnMinWidth + gap),
            }}
          >
            <div className="col-span-full grid grid-cols-subgrid items-center text-sm font-semibold">
              <span className="px-1">Story</span>
              {columns.map((column) => (
                <span key={column.id} className="flex min-w-0 items-center gap-2 px-1">
                  <span
                    className={cn('size-2 shrink-0 rounded-full', colorClasses[column.color].dot)}
                  />
                  <span className="truncate">{column.name}</span>
                </span>
              ))}
            </div>
            {stories.map((story) => lane(story.id, story))}
            {/* Always there, even empty: it's where a note goes to leave its story. */}
            {lane(NO_STORY, null)}
          </div>
        </DragDropProvider>
      </div>
      <NewStory
        board={board}
        stories={stories}
        adding={addingStory}
        onAddingChange={setAddingStory}
      />
    </div>
  )
}

/** One story (or no story) across every column: its card, then a cell per column. */
function Lane({
  lane,
  story,
  stories,
  board,
  columns,
  cells,
  cardsById,
  laneCards,
  doneColumnIds,
  emails,
  progress,
  sprintId,
  onOpenCard,
}: {
  lane: string
  /** Null for the cards in no story. */
  story: Story | null
  stories: Story[]
  board: Board
  columns: Column[]
  cells: Cells
  cardsById: Map<string, Card>
  /** The lane's cards the filters let through, in every column. */
  laneCards: Card[]
  doneColumnIds: Set<string>
  emails: Map<string, string>
  progress: ChecklistProgress
  sprintId: string | null
  onOpenCard: (id: string) => void
}) {
  const title = story?.title ?? 'No story'
  const excerpt = story
    ? story.description.replace(/\s+/g, ' ').trim()
    : 'Tasks that are not part of a story.'
  const stats = laneStats(laneCards, doneColumnIds)

  return (
    <section aria-label={title} className="col-span-full grid grid-cols-subgrid">
      <Panel size="sm" className="min-w-0">
        <CardHeader>
          {/* The h2 takes CardTitle's type (preflight resets headings) and
              keeps lanes in the heading outline, like the board's columns. */}
          <CardTitle className="min-w-0 wrap-break-word">
            <h2>{title}</h2>
          </CardTitle>
          {excerpt ? (
            <CardDescription className="line-clamp-2" title={excerpt}>
              {excerpt}
            </CardDescription>
          ) : null}
          {story ? (
            <CardAction>
              <StoryMenu story={story} stories={stories} />
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-2">
            <span title="Estimated across the tasks shown">{daysLabel(stats.days, 'long')}</span>
            <span>
              {stats.total === 0 ? 'No tasks' : `${stats.done} of ${stats.total} done`}
            </span>
          </div>
          <Progress
            value={stats.total === 0 ? 0 : (stats.done / stats.total) * 100}
            aria-label={`${title}: tasks done`}
          />
        </CardContent>
        {/* At the bottom however tall the lane's notes make the row. */}
        <CardFooter className="mt-auto flex-col items-stretch">
          <AddTask
            board={board}
            column={columns[0]}
            storyId={laneStoryId(lane)}
            sprintId={sprintId}
          />
        </CardFooter>
      </Panel>

      {columns.map((column) => {
        const id = cellId(lane, column.id)
        return (
          <Cell key={id} id={id} label={`${title}, ${column.name}`}>
            {(cells[id] ?? []).map((cardId, index) => {
              const card = cardsById.get(cardId)
              if (!card) return null
              return (
                <SortableNote
                  key={cardId}
                  index={index}
                  cell={id}
                  card={card}
                  done={doneColumnIds.has(column.id)}
                  boardKey={board.key}
                  assignee={
                    card.assignee_id
                      ? (emails.get(card.assignee_id) ?? 'Unknown account')
                      : undefined
                  }
                  progress={progress.get(cardId)}
                  onOpen={() => onOpenCard(cardId)}
                />
              )
            })}
          </Cell>
        )
      })}
    </section>
  )
}

/** Where a story meets a column. Notes land here when there is none to drop next to. */
function Cell({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const { ref, isDropTarget } = useDroppable({
    id,
    type: 'cell',
    accept: 'card',
    collisionPriority: CollisionPriority.Lowest,
  })
  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      className={cn(
        'flex min-h-28 min-w-0 flex-wrap content-start items-start gap-2 rounded-xl bg-column p-2',
        isDropTarget && 'ring-2 ring-primary ring-inset',
      )}
    >
      {children}
    </div>
  )
}

function SortableNote({
  index,
  cell,
  card,
  done,
  boardKey,
  assignee,
  progress,
  onOpen,
}: {
  index: number
  cell: string
  card: Card
  done: boolean
  boardKey: string
  assignee: string | undefined
  progress: { done: number; total: number } | undefined
  onOpen: () => void
}) {
  const { ref, isDragging } = useSortable({
    id: card.id,
    index,
    group: cell,
    type: 'card',
    accept: 'card',
  })
  return (
    <StoryNote
      ref={ref}
      card={card}
      done={done}
      boardKey={boardKey}
      assignee={assignee}
      progress={progress}
      dragging={isDragging}
      onOpen={onOpen}
    />
  )
}
