import { useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { DragDropProvider, KeyboardSensor, PointerSensor, useDroppable } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import { CollisionPriority } from '@dnd-kit/abstract'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { columnsCollection } from '@/data/collections'
import { moveCard } from '@/data/actions'
import type { Board, Card, Column, Label } from '@/data/schemas'
import { useEmails } from '@/hooks/use-board-people'
import { currentUserId } from '@/lib/auth'
import { placeAt, positionAfterLast, positionBetween, withItemAt } from '@/lib/position'
import { cn } from '@/lib/utils'
import { AddCard } from './add-card'
import { CardTile } from './card-tile'
import { ColumnMenu } from './column-menu'
import type { ChecklistProgress } from './view-props'

type Items = Record<string, string[]>

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

function reportFailure(what: string) {
  return (error: Error) => toast.add({ title: what, description: error.message, type: 'error' })
}

export function BoardColumns({
  board,
  columns,
  cards,
  labels,
  progress,
  sprintId,
  onOpenCard,
}: {
  board: Board
  columns: Column[]
  cards: Card[]
  labels: Label[]
  progress: ChecklistProgress
  sprintId: string | null
  onOpenCard: (id: string) => void
}) {
  const derivedItems = useMemo(() => {
    const items: Items = Object.fromEntries(columns.map((c) => [c.id, [] as string[]]))
    for (const card of cards) items[card.column_id]?.push(card.id)
    return items
  }, [columns, cards])
  const derivedOrder = useMemo(() => columns.map((c) => c.id), [columns])

  // During a drag, dnd-kit moves the DOM nodes itself (optimistic sorting)
  // and React state stays put. After a drop or a cancel the columns are
  // remounted under a new key, so React builds fresh DOM instead of
  // reconciling nodes dnd-kit moved, which otherwise throws "removeChild …
  // not a child of this node".
  const [generation, setGeneration] = useState(0)
  const items = derivedItems
  const order = derivedOrder

  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const columnsById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns])
  const labelsById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels])
  const emails = useEmails()

  function dropCard(cardId: string, finalItems: Items) {
    const card = cardsById.get(cardId)
    const toId = Object.keys(finalItems).find((id) => finalItems[id]!.includes(cardId))
    if (!card || !toId) return
    const list = finalItems[toId]!
    const index = list.indexOf(cardId)
    const before = cardsById.get(list[index - 1] ?? '')?.position
    const after = cardsById.get(list[index + 1] ?? '')?.position
    const unchanged =
      toId === card.column_id &&
      (before === undefined || before < card.position) &&
      (after === undefined || after > card.position)
    if (unchanged) return
    const from = columnsById.get(card.column_id)!
    const to = columnsById.get(toId)!
    moveCard(card, from, to, positionBetween(before, after)).isPersisted.promise.catch(
      reportFailure('Move not saved'),
    )
  }

  function dropColumn(columnId: string, finalOrder: string[]) {
    const index = finalOrder.indexOf(columnId)
    if (index === derivedOrder.indexOf(columnId)) return
    const before = columnsById.get(finalOrder[index - 1] ?? '')?.position
    const after = columnsById.get(finalOrder[index + 1] ?? '')?.position
    columnsCollection
      .update(columnId, (draft) => {
        draft.position = positionBetween(before, after)
      })
      .isPersisted.promise.catch(reportFailure('Column order not saved'))
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-7 sm:px-7">
      <DragDropProvider
        sensors={sensors}
        onDragEnd={(event) => {
          const { source, target } = event.operation
          if (!isSortable(source)) return
          // dnd-kit moved nodes while dragging, and a cancel doesn't put back a
          // card dragged into another column. Remount either way, swapping in
          // fresh DOM before the data change renders.
          flushSync(() => setGeneration((g) => g + 1))
          if (event.canceled) return
          const id = String(source.id)
          if (source.type === 'column') {
            dropColumn(id, placeAt(derivedOrder, id, source.sortable.index))
            return
          }
          // Dropped on a column's card area (e.g. an empty column): append.
          // Otherwise dnd-kit has already slotted it among the cards.
          const listColumn =
            target?.type === 'card-list' ? String(target.id).replace(/:cards$/, '') : null
          const columnId = listColumn ?? String(source.sortable.group)
          const list = derivedItems[columnId]
          if (!list) return
          const index = listColumn ? list.length : source.sortable.index
          dropCard(id, withItemAt(derivedItems, columnId, id, index))
        }}
      >
        <div key={generation} className="flex w-max items-start gap-3.5">
          {order.map((columnId, index) => {
            const column = columnsById.get(columnId)
            if (!column) return null
            return (
              <BoardColumn
                key={column.id}
                index={index}
                board={board}
                column={column}
                columns={columns}
                cardIds={items[column.id] ?? []}
                cardsById={cardsById}
                labelsById={labelsById}
                emails={emails}
                progress={progress}
                sprintId={sprintId}
                onOpenCard={onOpenCard}
              />
            )
          })}
          <AddColumn board={board} columns={columns} />
        </div>
      </DragDropProvider>
    </div>
  )
}

function BoardColumn({
  index,
  board,
  column,
  columns,
  cardIds,
  cardsById,
  labelsById,
  emails,
  progress,
  sprintId,
  onOpenCard,
}: {
  index: number
  board: Board
  column: Column
  columns: Column[]
  cardIds: string[]
  cardsById: Map<string, Card>
  labelsById: Map<string, Label>
  emails: Map<string, string>
  progress: ChecklistProgress
  sprintId: string | null
  onOpenCard: (id: string) => void
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id: column.id,
    index,
    type: 'column',
    accept: 'column',
    collisionPriority: CollisionPriority.Low,
  })
  // Cards land here when there is no card to drop next to.
  const { ref: cardListRef, isDropTarget } = useDroppable({
    id: `${column.id}:cards`,
    type: 'card-list',
    accept: 'card',
    collisionPriority: CollisionPriority.Lowest,
  })
  const overLimit = column.wip_limit !== null && cardIds.length > column.wip_limit

  return (
    <section
      ref={ref}
      aria-label={column.name}
      className={cn(
        'flex w-[300px] shrink-0 flex-col gap-2 rounded-xl bg-column p-2.5',
        isDropTarget && 'ring-2 ring-primary ring-inset',
        isDragging && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-2 px-1 pt-0.5">
        <h2
          ref={handleRef}
          className="flex min-w-0 cursor-grab items-center gap-2 text-sm font-semibold active:cursor-grabbing"
          title="Drag to reorder columns"
        >
          <span className="truncate">{column.name}</span>
        </h2>
        <span className="text-xs text-muted-foreground">{cardIds.length}</span>
        {column.wip_limit !== null ? (
          <span
            className={cn(
              'rounded-full px-1.5 text-[11px] font-semibold',
              overLimit
                ? 'bg-label-red text-label-red-foreground'
                : 'bg-label-gray text-label-gray-foreground',
            )}
            title={overLimit ? 'Over the work-in-progress limit' : 'Work-in-progress limit'}
          >
            WIP {cardIds.length}/{column.wip_limit}
          </span>
        ) : null}
        <ColumnMenu
          className="ml-auto"
          column={column}
          columns={columns}
        />
      </div>

      <div ref={cardListRef} className="flex min-h-12 flex-col gap-2">
        {cardIds.map((id, i) => {
          const card = cardsById.get(id)
          if (!card) return null
          return (
            <SortableCard
              key={id}
              index={i}
              card={card}
              column={column}
              boardKey={board.key}
              labels={card.label_ids.map((l) => labelsById.get(l)).filter((l) => l !== undefined)}
              assignee={
                card.assignee_id ? (emails.get(card.assignee_id) ?? 'Unknown account') : undefined
              }
              progress={progress.get(id)}
              onOpen={() => onOpenCard(id)}
            />
          )
        })}
      </div>

      <AddCard
        board={board}
        column={column}
        sprintId={sprintId}
        siblings={cardIds.map((id) => cardsById.get(id)?.position ?? 0)}
      />
    </section>
  )
}

function SortableCard({
  index,
  card,
  column,
  boardKey,
  labels,
  assignee,
  progress,
  onOpen,
}: {
  index: number
  card: Card
  column: Column
  boardKey: string
  labels: Label[]
  assignee: string | undefined
  progress: { done: number; total: number } | undefined
  onOpen: () => void
}) {
  const { ref, isDragging } = useSortable({
    id: card.id,
    index,
    group: column.id,
    type: 'card',
    accept: 'card',
  })
  return (
    <CardTile
      ref={ref}
      card={card}
      done={column.is_done}
      boardKey={boardKey}
      labels={labels}
      assignee={assignee}
      progress={progress}
      dragging={isDragging}
      onOpen={onOpen}
    />
  )
}

function AddColumn({ board, columns }: { board: Board; columns: Column[] }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) {
      setAdding(false)
      return
    }
    columnsCollection
      .insert({
        id: crypto.randomUUID(),
        owner_id: currentUserId(),
        board_id: board.id,
        name: trimmed,
        color: 'gray',
        position: positionAfterLast(columns.map((c) => c.position)),
        wip_limit: null,
        is_done: false,
        created_at: new Date().toISOString(),
      })
      .isPersisted.promise.catch(reportFailure('Column not saved'))
    setName('')
  }

  if (!adding) {
    return (
      <Button
        variant="outline"
        className="h-12 w-60 shrink-0 border-dashed bg-transparent"
        onClick={() => setAdding(true)}
      >
        <PlusIcon data-icon="inline-start" />
        Add column
      </Button>
    )
  }

  return (
    <form
      className="flex w-[300px] shrink-0 flex-col gap-2 rounded-xl bg-column p-2.5"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Input
        autoFocus
        aria-label="Column name"
        placeholder="Column name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setAdding(false)
        }}
        onBlur={submit}
      />
    </form>
  )
}
