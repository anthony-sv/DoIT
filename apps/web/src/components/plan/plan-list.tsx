import { Link } from '@tanstack/react-router'
import { useDroppable } from '@dnd-kit/react'
import { useSortable } from '@dnd-kit/react/sortable'
import { CollisionPriority } from '@dnd-kit/abstract'
import { CircleCheckIcon, GripVerticalIcon } from 'lucide-react'
import { PersonAvatar } from '@/components/person-avatar'
import { Badge } from '@/components/ui/badge'
import type { Board, Card, Label } from '@/data/schemas'
import { colorClasses } from '@/lib/colors'
import { cardKey, daysLabel, priorityNames } from '@/lib/format'
import { cn } from '@/lib/utils'

/** The backlog or a sprint: sortable card rows that cards can be dropped into. */
export function PlanList({
  id,
  ids,
  byId,
  labelsById,
  emails,
  board,
  isDone,
  bordered,
  empty,
}: {
  id: string
  ids: string[]
  byId: Map<string, Card>
  labelsById: Map<string, Label>
  emails: Map<string, string>
  board: Board
  isDone: (card: Card) => boolean
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
        // A container, so rows drop their labels when the list is narrow
        // (a sprint beside the backlog) rather than squeezing the title.
        '@container flex min-h-16 flex-col',
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
            assignee={
              card.assignee_id ? (emails.get(card.assignee_id) ?? 'Unknown account') : undefined
            }
            board={board}
            done={isDone(card)}
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
  assignee,
  board,
  done,
  bordered,
}: {
  index: number
  listId: string
  card: Card
  labels: Label[]
  assignee: string | undefined
  board: Board
  done: boolean
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
        className={cn(
          'min-w-0 flex-1 truncate text-sm hover:underline',
          done && 'text-muted-foreground',
        )}
      >
        {card.title}
      </Link>
      {labels.slice(0, 2).map((l) => (
        <Badge key={l.id} variant="secondary" className={cn('@max-xl:hidden', colorClasses[l.color].chip)}>
          {l.name}
        </Badge>
      ))}
      <span className="w-12 shrink-0 text-right text-xs text-muted-foreground @max-sm:hidden">
        {card.estimate !== null ? daysLabel(card.estimate) : null}
      </span>
      <span className="flex w-6 shrink-0 justify-center">
        {assignee ? <PersonAvatar email={assignee} label={`Assigned to ${assignee}`} /> : null}
      </span>
      {done ? (
        <span className="flex w-14 shrink-0 justify-end">
          <CircleCheckIcon className="size-4 text-label-green-foreground" aria-label="Done" />
        </span>
      ) : (
        <span
          className={cn(
            'w-14 shrink-0 text-right text-xs',
            urgent ? 'font-semibold text-destructive' : 'text-muted-foreground',
          )}
        >
          {priorityNames[card.priority]}
        </span>
      )}
    </li>
  )
}
