import { useState } from 'react'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { Markdown } from '@tanstack/markdown/react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { boardMembersCollection, cardEventsCollection } from '@/data/collections'
import { logEvent } from '@/data/actions'
import type { Card } from '@/data/schemas'
import { useEmails } from '@/hooks/use-board-people'
import { currentUserId } from '@/lib/auth'

function reportFailure(what: string) {
  return (error: Error) => toast.add({ title: what, description: error.message, type: 'error' })
}

function ago(iso: string) {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true })
}

/**
 * Who did something, on a shared board only: alone on a board, it's always you.
 * Null when it isn't worth saying.
 */
function useAuthor(boardId: string) {
  const emails = useEmails()
  const { data: members } = useLiveQuery(
    (q) =>
      q.from({ member: boardMembersCollection }).where(({ member }) => eq(member.board_id, boardId)),
    [boardId],
  )
  const shared = members.length > 0
  return (userId: string | null) => {
    if (!shared) return null
    if (userId === null) return 'A former member'
    return userId === currentUserId() ? 'You' : (emails.get(userId) ?? 'Someone')
  }
}

export function CardActivity({ card }: { card: Card }) {
  const [comment, setComment] = useState('')
  const author = useAuthor(card.board_id)
  const creator = author(card.created_by)
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
          logEvent(card.id, 'comment', comment.trim()).isPersisted.promise.catch(
            reportFailure('Comment not saved'),
          )
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
          <li key={event.id} className="group flex gap-2.5">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
            {event.kind === 'comment' ? (
              <>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    {author(event.created_by) ?? 'Comment'} · {ago(event.created_at)}
                  </span>
                  <div className="prose-doit">
                    <Markdown>{event.body}</Markdown>
                  </div>
                </div>
                {/* Touch screens can't hover, so there it always shows. */}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Delete comment"
                  className="-mt-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
                  onClick={() =>
                    cardEventsCollection
                      .delete(event.id)
                      .isPersisted.promise.catch(reportFailure('Comment not deleted'))
                  }
                >
                  <Trash2Icon />
                </Button>
              </>
            ) : (
              <span className="text-muted-foreground">
                {author(event.created_by) ? `${author(event.created_by)} · ` : ''}
                {event.kind === 'assigned' ? (
                  event.body ? (
                    <>
                      Assigned to <span className="font-medium text-foreground">{event.body}</span>
                    </>
                  ) : (
                    'Unassigned'
                  )
                ) : (
                  <>
                    {event.kind === 'moved' ? 'Moved ' : ''}
                    <span className="font-medium text-foreground">{event.body}</span>
                  </>
                )}{' '}
                ·{' '}
                {ago(event.created_at)}
              </span>
            )}
          </li>
        ))}
        <li className="flex gap-2.5 text-muted-foreground">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
          {creator ? `Created by ${creator === 'You' ? 'you' : creator}` : 'Created'} ·{' '}
          {ago(card.created_at)}
        </li>
      </ol>
    </section>
  )
}
