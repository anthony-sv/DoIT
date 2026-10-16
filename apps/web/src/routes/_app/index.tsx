import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { KanbanIcon, PlusIcon } from 'lucide-react'
import { NewBoardDialog } from '@/components/new-board-dialog'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { boardsCollection } from '@/data/collections'

export const Route = createFileRoute('/_app/')({
  // Loaders run in parallel, so wait for boards here rather than trusting the
  // parent's preload to have finished.
  loader: async () => {
    await boardsCollection.preload()
    const first = boardsCollection.toArray
      .filter((b) => !b.archived_at)
      .sort((a, b) => a.position - b.position)[0]
    if (first) throw redirect({ to: '/b/$boardId', params: { boardId: first.id } })
  },
  component: NoBoards,
})

function NoBoards() {
  const [open, setOpen] = useState(false)
  return (
    <Empty className="min-h-svh">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <KanbanIcon />
        </EmptyMedia>
        <EmptyTitle>No boards yet</EmptyTitle>
        <EmptyDescription>
          A board holds columns of cards. Make one per thing you track.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => setOpen(true)}>
          <PlusIcon data-icon="inline-start" />
          New board
        </Button>
      </EmptyContent>
      <NewBoardDialog open={open} onOpenChange={setOpen} />
    </Empty>
  )
}
