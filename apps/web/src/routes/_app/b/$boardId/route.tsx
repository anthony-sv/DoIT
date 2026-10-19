import { Link, Outlet, createFileRoute, notFound } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { boardsCollection } from '@/data/collections'
import { rememberBoard } from '@/lib/last-board'

// Runs once a navigation lands here, not on hover preloads. Archived boards
// aren't remembered: "/" and the sidebar skip them, so remembering one would
// lose the open board you were on before.
function remember({ params }: { params: { boardId: string } }) {
  const board = boardsCollection.get(params.boardId)
  if (board && !board.archived_at) rememberBoard(board.id)
}

export const Route = createFileRoute('/_app/b/$boardId')({
  loader: async ({ params }) => {
    await boardsCollection.preload()
    if (!boardsCollection.get(params.boardId)) throw notFound()
  },
  onEnter: remember,
  onStay: remember,
  notFoundComponent: () => (
    <Empty className="min-h-svh">
      <EmptyHeader>
        <EmptyTitle>Board not found</EmptyTitle>
        <EmptyDescription>It may have been deleted, or the link is wrong.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button nativeButton={false} render={<Link to="/" />}>
          Go to your boards
        </Button>
      </EmptyContent>
    </Empty>
  ),
  component: Outlet,
})
