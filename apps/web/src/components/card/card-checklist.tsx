import { useState } from 'react'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { PlusIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { toast } from '@/components/ui/toast'
import { checklistItemsCollection } from '@/data/collections'
import { currentUserId } from '@/lib/auth'
import { positionAfterLast } from '@/lib/position'
import { cn } from '@/lib/utils'

function reportFailure(what: string) {
  return (error: Error) => toast.add({ title: what, description: error.message, type: 'error' })
}

export function CardChecklist({ cardId }: { cardId: string }) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const { data: items } = useLiveQuery({
    query: (q) =>
      q
        .from({ item: checklistItemsCollection })
        .where(({ item }) => eq(item.card_id, cardId))
        .orderBy(({ item }) => item.position),
  })
  const done = items.filter((i) => i.done).length

  function add() {
    const trimmed = text.trim()
    if (!trimmed) return
    checklistItemsCollection
      .insert({
        id: crypto.randomUUID(),
        owner_id: currentUserId(),
        card_id: cardId,
        text: trimmed,
        done: false,
        position: positionAfterLast(items.map((i) => i.position)),
        created_at: new Date().toISOString(),
      })
      .isPersisted.promise.catch(reportFailure('Item not saved'))
    setText('')
  }

  return (
    <section aria-labelledby="checklist-heading" className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <h2 id="checklist-heading" className="text-sm font-semibold">
          Checklist
        </h2>
        {items.length > 0 ? (
          <span className="text-sm text-muted-foreground">
            {done} of {items.length}
          </span>
        ) : null}
      </div>
      {items.length > 0 ? (
        <Progress value={(done / items.length) * 100} aria-label="Checklist progress" />
      ) : null}
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.id} className="group flex min-h-9 items-center gap-2.5">
            <Checkbox
              id={`check-${item.id}`}
              checked={item.done}
              onCheckedChange={(checked) =>
                checklistItemsCollection
                  .update(item.id, (d) => {
                    d.done = checked === true
                  })
                  .isPersisted.promise.catch(reportFailure('Item not saved'))
              }
            />
            <label
              htmlFor={`check-${item.id}`}
              className={cn('flex-1 text-sm', item.done && 'text-muted-foreground line-through')}
            >
              {item.text}
            </label>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Remove “${item.text}”`}
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              onClick={() =>
                checklistItemsCollection
                  .delete(item.id)
                  .isPersisted.promise.catch(reportFailure('Item not removed'))
              }
            >
              <XIcon />
            </Button>
          </li>
        ))}
      </ul>
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <Input
            autoFocus
            aria-label="New checklist item"
            placeholder="Add an item, Enter to save"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setAdding(false)
            }}
            onBlur={() => {
              add()
              setAdding(false)
            }}
          />
        </form>
      ) : (
        <Button
          variant="ghost"
          className="justify-start text-muted-foreground"
          onClick={() => setAdding(true)}
        >
          <PlusIcon data-icon="inline-start" />
          Add item
        </Button>
      )}
    </section>
  )
}
