import { useState } from 'react'
import { count, eq, useLiveQuery } from '@tanstack/react-db'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import {
  boardsCollection,
  cardsCollection,
  columnsCollection,
  labelsCollection,
  sprintsCollection,
} from '@/data/collections'
import { removeBoard } from '@/data/actions'
import type { Board } from '@/data/schemas'
import { useLeaveBoard } from '@/hooks/use-leave-board'

function reportFailure(what: string) {
  return (error: Error) => toast.add({ title: what, description: error.message, type: 'error' })
}

export function DeleteBoardDialog({
  board,
  open,
  onOpenChange,
}: {
  board: Board
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {/* Mounts with each opening: fresh counts, and the typed name starts empty. */}
        <ConfirmDelete board={board} onDone={() => onOpenChange(false)} />
      </AlertDialogContent>
    </AlertDialog>
  )
}

function useCountOnBoard(
  collection:
    | typeof cardsCollection
    | typeof sprintsCollection
    | typeof columnsCollection
    | typeof labelsCollection,
  boardId: string,
) {
  const { data } = useLiveQuery({
    query: (q) =>
      q
        .from({ row: collection })
        .where(({ row }) => eq(row.board_id, boardId))
        .select(({ row }) => ({ n: count(row.id) })),
  })
  return data[0]?.n ?? 0
}

function plural(n: number, noun: string) {
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}

function ConfirmDelete({ board, onDone }: { board: Board; onDone: () => void }) {
  const leaveBoard = useLeaveBoard()
  const [typed, setTyped] = useState('')
  const cards = useCountOnBoard(cardsCollection, board.id)
  const sprints = useCountOnBoard(sprintsCollection, board.id)
  const columns = useCountOnBoard(columnsCollection, board.id)
  const labels = useCountOnBoard(labelsCollection, board.id)

  const matches = typed.trim() === board.name
  const goes = [
    plural(cards, 'card'),
    plural(sprints, 'sprint'),
    plural(columns, 'column'),
    plural(labels, 'label'),
  ]
  const summary =
    `Deletes ${goes.slice(0, -1).join(', ')} and ${goes.at(-1)}` +
    (cards > 0 ? ', with every checklist and comment on them' : '') +
    '. This can’t be undone.'

  function confirm() {
    onDone()
    const remove = () =>
      removeBoard(board).isPersisted.promise.catch(reportFailure('Board not deleted'))
    // Off the board first, so its page never renders without it. With no other
    // open board the way off is home, and home's loader would redirect straight
    // back here while the board still exists, so then the delete goes first.
    const anotherOpen = boardsCollection.toArray.some((b) => !b.archived_at && b.id !== board.id)
    if (anotherOpen) {
      void leaveBoard(board).then(remove)
    } else {
      remove()
      void leaveBoard(board)
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (matches) confirm()
      }}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>Delete “{board.name}”?</AlertDialogTitle>
        <AlertDialogDescription>{summary}</AlertDialogDescription>
      </AlertDialogHeader>
      <Field>
        <FieldLabel htmlFor="delete-board-name">Type “{board.name}” to confirm</FieldLabel>
        <Input
          id="delete-board-name"
          autoComplete="off"
          spellCheck={false}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      </Field>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction type="submit" variant="destructive" disabled={!matches}>
          Delete board
        </AlertDialogAction>
      </AlertDialogFooter>
    </form>
  )
}
