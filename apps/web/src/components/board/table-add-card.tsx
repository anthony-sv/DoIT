import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { PlusIcon } from 'lucide-react'
import { reportFailure } from '@/components/card/card-writes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TableCell, TableRow } from '@/components/ui/table'
import { cardsCollection } from '@/data/collections'
import { addCard } from '@/data/actions'
import type { Board, Column } from '@/data/schemas'
import { positionAfterLast } from '@/lib/position'

const ascending = (a: number, b: number) => a - b

/** The last row of a group: a card added here goes to the bottom of its column. */
export function TableAddCard({
  board,
  column,
  sprintId,
  colSpan,
}: {
  board: Board
  column: Column
  sprintId: string | null
  colSpan: number
}) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const buttonRef = useRef<HTMLButtonElement>(null)

  function submit() {
    const trimmed = title.trim()
    if (!trimmed) return
    // After every card in the column and on the board, not only the ones the
    // sprint and text filters let through.
    const onBoard = cardsCollection.toArray.filter((c) => c.board_id === board.id)
    addCard({
      board,
      column,
      title: trimmed,
      sprintId,
      position: positionAfterLast(
        onBoard.filter((c) => c.column_id === column.id).map((c) => c.position).sort(ascending),
      ),
      backlogPosition: positionAfterLast(onBoard.map((c) => c.backlog_position).sort(ascending)),
    }).isPersisted.promise.catch(reportFailure('Card not saved'))
    // Stay open for the next one.
    setTitle('')
  }

  function close() {
    setTitle('')
    // Render the button before focusing it, so focus isn't lost with the input.
    flushSync(() => setAdding(false))
    buttonRef.current?.focus()
  }

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-1">
        {adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <Input
              autoFocus
              aria-label={`New card in ${column.name}`}
              placeholder="Card title, then Enter"
              className="h-7 max-w-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') close()
              }}
              // Leaving it empty closes it; typed text stays until Enter or Escape.
              onBlur={() => {
                if (!title.trim()) setAdding(false)
              }}
            />
          </form>
        ) : (
          <Button
            ref={buttonRef}
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            aria-label={`Add card to ${column.name}`}
            onClick={() => setAdding(true)}
          >
            <PlusIcon data-icon="inline-start" />
            Add card
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}
