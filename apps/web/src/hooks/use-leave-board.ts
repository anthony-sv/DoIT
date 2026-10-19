import { useNavigate, useParams } from '@tanstack/react-router'
import { boardsCollection } from '@/data/collections'
import type { Board } from '@/data/schemas'

/**
 * For a board that is going away (archived or deleted): when you are on any
 * of its pages, go to the open board below it in the sidebar (else the one
 * above), or home when there is none. Resolves once the move is done.
 */
export function useLeaveBoard() {
  const navigate = useNavigate()
  const { boardId } = useParams({ strict: false })
  return async (board: Board) => {
    if (boardId !== board.id) return
    const open = boardsCollection.toArray
      .filter((b) => !b.archived_at && b.id !== board.id)
      .sort((a, b) => a.position - b.position)
    const next = open.find((b) => b.position > board.position) ?? open.at(-1)
    // Replace: going back would land on a board that is gone.
    await (next
      ? navigate({ to: '/b/$boardId', params: { boardId: next.id }, replace: true })
      : navigate({ to: '/', replace: true }))
  }
}
