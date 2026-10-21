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
import { toast } from '@/components/ui/toast'
import { leaveSharedBoard } from '@/data/actions'
import { boardsCollection } from '@/data/collections'
import type { Board } from '@/data/schemas'
import { useEmails } from '@/hooks/use-board-people'
import { useLeaveBoard } from '@/hooks/use-leave-board'

/** A member takes themselves off a board someone else owns. */
export function LeaveBoardDialog({
  board,
  open,
  onOpenChange,
}: {
  board: Board
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const leaveBoard = useLeaveBoard()
  const owner = useEmails().get(board.owner_id) ?? 'its owner'

  function confirm() {
    onOpenChange(false)
    const leave = () =>
      leaveSharedBoard(board).isPersisted.promise.catch((error: Error) =>
        toast.add({ title: 'Couldn’t leave the board', description: error.message, type: 'error' }),
      )
    // As for deleting: off the board first, unless home is the only way off
    // (its loader would send us straight back while the board is still here).
    const anotherOpen = boardsCollection.toArray.some((b) => !b.archived_at && b.id !== board.id)
    if (anotherOpen) {
      void leaveBoard(board).then(leave)
    } else {
      leave()
      void leaveBoard(board)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave “{board.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            It leaves your sidebar, and you can’t open it until {owner} shares it with you again.
            The cards and comments you added stay on it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm}>
            Leave board
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
