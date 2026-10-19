import { type ReactElement, useState } from 'react'
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  EllipsisIcon,
  PencilIcon,
  TagIcon,
  Trash2Icon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/toast'
import { archiveBoard } from '@/data/actions'
import type { Board } from '@/data/schemas'
import { useLeaveBoard } from '@/hooks/use-leave-board'
import { DeleteBoardDialog } from './delete-board-dialog'
import { EditBoardDialog } from './edit-board-dialog'
import { LabelsDialog } from './labels-dialog'

function reportFailure(what: string) {
  return (error: Error) => toast.add({ title: what, description: error.message, type: 'error' })
}

/**
 * Edit, labels, archive and delete for one board. It renders its own dialogs,
 * so the board header and every sidebar row can each show one.
 */
export function BoardMenu({
  board,
  trigger = <Button variant="ghost" size="icon-sm" />,
}: {
  board: Board
  /** The element that opens the menu; it gets the ellipsis icon and a label. */
  trigger?: ReactElement
}) {
  const [editing, setEditing] = useState(false)
  const [labelsOpen, setLabelsOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const leaveBoard = useLeaveBoard()
  const archived = board.archived_at !== null

  function toggleArchived() {
    archiveBoard(board, !archived).isPersisted.promise.catch(
      reportFailure(archived ? 'Board not restored' : 'Board not archived'),
    )
    if (!archived) void leaveBoard(board)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={trigger} aria-label={`${board.name} board options`}>
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <PencilIcon />
              Edit board…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLabelsOpen(true)}>
              <TagIcon />
              Labels…
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={toggleArchived}>
              {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
              {archived ? 'Restore board' : 'Archive board'}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
              <Trash2Icon />
              Delete board…
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditBoardDialog board={board} open={editing} onOpenChange={setEditing} />
      <LabelsDialog board={board} open={labelsOpen} onOpenChange={setLabelsOpen} />
      <DeleteBoardDialog board={board} open={deleting} onOpenChange={setDeleting} />
    </>
  )
}
