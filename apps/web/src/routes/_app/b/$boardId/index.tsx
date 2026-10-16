import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { BoardView } from '@/components/board/board-view'

const boardSearch = z.object({
  // A sprint id, or "all" for every card not in a closed sprint. Missing means
  // the active sprint when there is one.
  sprint: z.string().optional().catch(undefined),
  // The card open in the detail drawer.
  card: z.string().uuid().optional().catch(undefined),
  q: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_app/b/$boardId/')({
  validateSearch: boardSearch,
  component: BoardPage,
})

function BoardPage() {
  const { boardId } = Route.useParams()
  return <BoardView boardId={boardId} />
}
