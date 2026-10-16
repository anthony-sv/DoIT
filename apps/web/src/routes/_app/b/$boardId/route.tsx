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

export const Route = createFileRoute('/_app/b/$boardId')({
  loader: async ({ params }) => {
    await boardsCollection.preload()
    if (!boardsCollection.get(params.boardId)) throw notFound()
  },
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
