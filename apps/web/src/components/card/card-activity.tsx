import { useState } from 'react'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { Markdown } from '@tanstack/markdown/react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cardEventsCollection } from '@/data/collections'
import { logEvent } from '@/data/actions'
import type { Card } from '@/data/schemas'

function ago(iso: string) {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true })
}

export function CardActivity({ card }: { card: Card }) {
  const [comment, setComment] = useState('')
  const { data: events } = useLiveQuery({
    query: (q) =>
      q
        .from({ event: cardEventsCollection })
        .where(({ event }) => eq(event.card_id, card.id))
        .orderBy(({ event }) => event.created_at, 'desc'),
  })

  return (
    <section aria-labelledby="activity-heading" className="flex flex-col gap-3">
      <h2 id="activity-heading" className="text-sm font-semibold">
        Activity
      </h2>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!comment.trim()) return
          logEvent(card.id, 'comment', comment.trim())
          setComment('')
        }}
      >
        <Textarea
          rows={2}
          aria-label="Add a comment"
          placeholder="Add a comment — Markdown works"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        {comment.trim() ? (
          <Button type="submit" size="sm" className="self-start">
            Comment
          </Button>
        ) : null}
      </form>
      <ol className="flex flex-col gap-3 text-sm">
        {events.map((event) => (
          <li key={event.id} className="flex gap-2.5">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
            {event.kind === 'comment' ? (
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  Comment · {ago(event.created_at)}
                </span>
                <div className="prose-doit">
                  <Markdown>{event.body}</Markdown>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground">
                {event.kind === 'moved' ? 'Moved ' : ''}
                <span className="font-medium text-foreground">{event.body}</span> ·{' '}
                {ago(event.created_at)}
              </span>
            )}
          </li>
        ))}
        <li className="flex gap-2.5 text-muted-foreground">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
          Created · {ago(card.created_at)}
        </li>
      </ol>
    </section>
  )
}
