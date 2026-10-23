import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { PlusIcon } from 'lucide-react'
import { reportFailure } from '@/components/card/card-writes'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cardsCollection } from '@/data/collections'
import { addCard } from '@/data/actions'
import type { Board, Column } from '@/data/schemas'
import { positionAfterLast } from '@/lib/position'

/** A new card in `storyId` (null: no story), in the board's first column. */
export function AddTask({
  board,
  column,
  storyId,
  sprintId,
}: {
  board: Board
  /** The board's first column; undefined while the board has none. */
  column: Column | undefined
  storyId: string | null
  sprintId: string | null
}) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Closing hands focus to the button that replaces the form, rather than
  // dropping it to the page with the textarea.
  function close() {
    flushSync(() => setAdding(false))
    buttonRef.current?.focus()
  }

  function submit() {
    const trimmed = title.trim()
    if (!trimmed || !column) return
    // Every card on the board, hidden ones too, so neither position lands on
    // one the filters hide.
    const onBoard = cardsCollection.toArray.filter((c) => c.board_id === board.id)
    const inColumn = onBoard
      .filter((c) => c.column_id === column.id)
      .map((c) => c.position)
      .sort((a, b) => a - b)
    const backlog = onBoard.map((c) => c.backlog_position).sort((a, b) => a - b)
    addCard({
      board,
      column,
      title: trimmed,
      sprintId,
      storyId,
      position: positionAfterLast(inColumn),
      backlogPosition: positionAfterLast(backlog),
    }).isPersisted.promise.catch(reportFailure('Card not saved'))
    setTitle('')
  }

  if (!adding || !column) {
    return (
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        className="justify-start text-muted-foreground"
        disabled={!column}
        onClick={() => setAdding(true)}
      >
        <PlusIcon data-icon="inline-start" />
        Add task
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
        maxLength={200}
        aria-label="Task title"
        placeholder={`New task in ${column.name}`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
          if (e.key === 'Escape') close()
        }}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Add task
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={close}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
