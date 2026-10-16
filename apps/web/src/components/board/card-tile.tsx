import type { Ref } from 'react'
import { CalendarIcon, CircleCheckIcon, ListChecksIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Card, Label } from '@/data/schemas'
import { colorClasses } from '@/lib/colors'
import { cardKey, dueInfo, priorityNames } from '@/lib/format'
import { cn } from '@/lib/utils'

export function CardTile({
  ref,
  card,
  done,
  boardKey,
  labels,
  progress,
  dragging,
  onOpen,
}: {
  ref?: Ref<HTMLDivElement>
  card: Card
  done: boolean
  boardKey: string
  labels: Label[]
  progress: { done: number; total: number } | undefined
  dragging?: boolean
  onOpen: () => void
}) {
  const due = card.due_on ? dueInfo(card.due_on, done) : null
  const urgent = card.priority === 'high' || card.priority === 'urgent'

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={`${cardKey(boardKey, card.number)} ${card.title}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen()
      }}
      className={cn(
        'flex cursor-pointer flex-col gap-2.5 rounded-[10px] border bg-card p-3 text-left text-card-foreground shadow-xs outline-none transition-shadow',
        'hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring',
        dragging && 'rotate-2 border-primary shadow-lg',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          {cardKey(boardKey, card.number)}
        </span>
        {done ? (
          <CircleCheckIcon className="size-4 text-label-green-foreground" aria-label="Done" />
        ) : (
          <span
            className={cn(
              'text-xs',
              urgent ? 'font-semibold text-destructive' : 'text-muted-foreground',
            )}
          >
            {priorityNames[card.priority]}
          </span>
        )}
      </div>

      <p className={cn('text-sm leading-5 font-medium', done && 'text-muted-foreground')}>
        {card.title}
      </p>

      {labels.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {labels.map((label) => (
            <Badge key={label.id} variant="secondary" className={colorClasses[label.color].chip}>
              {label.name}
            </Badge>
          ))}
        </div>
      ) : null}

      {progress && progress.total > 0 ? (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ListChecksIcon className="size-3.5" />
            {progress.done}/{progress.total}
          </span>
          <DueChip due={due} />
        </div>
      ) : due ? (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <DueChip due={due} />
        </div>
      ) : null}
    </div>
  )
}

function DueChip({ due }: { due: ReturnType<typeof dueInfo> | null }) {
  if (!due) return null
  return (
    <span
      className={cn(
        'flex items-center gap-1 rounded-md',
        due.state === 'overdue' && 'bg-label-red px-1.5 font-medium text-label-red-foreground',
        due.state === 'soon' && 'bg-label-amber px-1.5 font-medium text-label-amber-foreground',
      )}
    >
      {due.state === 'later' ? <CalendarIcon className="size-3.5" /> : null}
      {due.label}
    </span>
  )
}
