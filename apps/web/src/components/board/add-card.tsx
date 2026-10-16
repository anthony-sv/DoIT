import { useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { cardsCollection } from '@/data/collections'
import { addCard } from '@/data/actions'
import type { Board, Column } from '@/data/schemas'
import { positionAfterLast } from '@/lib/position'

export function AddCard({
  board,
  column,
  sprintId,
  siblings,
}: {
  board: Board
  column: Column
  sprintId: string | null
  siblings: number[]
}) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')

  function submit() {
    const trimmed = title.trim()
    if (!trimmed) return
    const backlog = cardsCollection.toArray
      .filter((c) => c.board_id === board.id)
      .map((c) => c.backlog_position)
      .sort((a, b) => a - b)
    addCard({
      board,
      column,
      title: trimmed,
      sprintId,
      position: positionAfterLast([...siblings].sort((a, b) => a - b)),
      backlogPosition: positionAfterLast(backlog),
    }).isPersisted.promise.catch((error: Error) =>
      toast.add({ title: 'Card not saved', description: error.message, type: 'error' }),
    )
    setTitle('')
  }

  if (!adding) {
    return (
      <Button
        variant="ghost"
        className="justify-start text-muted-foreground"
        onClick={() => setAdding(true)}
      >
        <PlusIcon data-icon="inline-start" />
        Add card
      </Button>
    )
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Textarea
        autoFocus
        rows={2}
        aria-label="Card title"
        placeholder="What needs doing?"
        className="bg-card"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
          if (e.key === 'Escape') setAdding(false)
        }}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Add card
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
