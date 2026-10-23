import type { CSSProperties, Ref } from 'react'
import { CircleCheckIcon, ListChecksIcon } from 'lucide-react'
import { PersonAvatar } from '@/components/person-avatar'
import type { Card } from '@/data/schemas'
import { colorClasses } from '@/lib/colors'
import { cardKey, daysLabel } from '@/lib/format'
import { noteSize, noteTitleLines } from '@/lib/sticky-notes'
import { cn } from '@/lib/utils'

/**
 * A task as a sticky note, as big as its estimate. Plain cards are
 * sticky-note yellow; a card with a color keeps it. The border, padding and
 * rows are what noteTitleLines counts on, so the rows have no gap between
 * them: the key row and the footer have room around their text already.
 */
export function StoryNote({
  ref,
  card,
  done,
  boardKey,
  assignee,
  progress,
  dragging,
  onOpen,
}: {
  ref?: Ref<HTMLDivElement>
  card: Card
  done: boolean
  boardKey: string
  /** The assignee's email; undefined when no one is on it. */
  assignee: string | undefined
  progress: { done: number; total: number } | undefined
  dragging?: boolean
  onOpen: () => void
}) {
  const size = noteSize(card.estimate)
  const key = cardKey(boardKey, card.number)
  const checklist =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : null
  const estimate =
    card.estimate === null ? 'no estimate' : `estimate ${daysLabel(card.estimate, 'long')}`

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={`${key} ${card.title}, ${estimate}${done ? ', done' : ''}${assignee ? `, assigned to ${assignee}` : ''}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen()
      }}
      style={{ width: size.width, height: size.height }}
      className={cn(
        'flex shrink-0 cursor-pointer flex-col rounded-sm border p-2 text-left text-card-foreground shadow-sm outline-none transition-shadow',
        colorClasses[card.color ?? 'amber'].card,
        'hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring',
        dragging && 'rotate-2 border-primary shadow-lg',
      )}
    >
      <div className="flex h-4 items-center justify-between gap-1">
        <span className="truncate font-mono text-[11px] text-muted-foreground">{key}</span>
        {done ? <CircleCheckIcon className="size-3.5 shrink-0 text-label-green-foreground" /> : null}
      </div>

      <p
        className={cn(
          'line-clamp-(--title-lines) text-[13px] leading-4 font-medium wrap-break-word',
          done && 'text-muted-foreground',
        )}
        style={{ '--title-lines': noteTitleLines(size.height) } as CSSProperties}
      >
        {card.title}
      </p>

      <div className="mt-auto flex h-5 items-center gap-2 text-[11px] text-muted-foreground">
        <span
          className={cn('font-semibold tabular-nums', card.estimate !== null && 'text-card-foreground')}
          title={card.estimate === null ? 'No estimate' : 'Estimate'}
        >
          {card.estimate === null ? '– d' : daysLabel(card.estimate)}
        </span>
        {checklist !== null ? (
          <span className="flex items-center gap-0.5 tabular-nums" title="Checklist done">
            <ListChecksIcon className="size-3" />
            {checklist}%
          </span>
        ) : null}
        {assignee ? (
          // The sm avatar is 24px through a data-size rule; the footer row is 20.
          <PersonAvatar email={assignee} className="ml-auto data-[size=sm]:size-5" />
        ) : null}
      </div>
    </div>
  )
}
