import { useEffect, useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { isNull, not, useLiveQuery } from '@tanstack/react-db'
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
import { SidebarTrigger } from '@/components/ui/sidebar'
import { boardsCollection } from '@/data/collections'
import type { Board } from '@/data/schemas'
import { readLastBoard } from '@/lib/last-board'

/** The open board "/" shows: the one you were last on, else the first. */
function boardToOpen(open: Board[]): Board | undefined {
  const last = readLastBoard()
  return open.find((b) => b.id === last) ?? open[0]
}

export const Route = createFileRoute('/_app/')({
  // Loaders run in parallel, so wait for boards here rather than trusting the
  // parent's preload to have finished.
  loader: async () => {
    await boardsCollection.preload()
    const open = boardsCollection.toArray
      .filter((b) => !b.archived_at)
      .sort((a, b) => a.position - b.position)
    const board = boardToOpen(open)
    if (board) throw redirect({ to: '/b/$boardId', params: { boardId: board.id } })
  },
  component: NoBoards,
})

function NoBoards() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { data: openBoards } = useLiveQuery({
    query: (q) =>
      q
        .from({ board: boardsCollection })
        .where(({ board }) => isNull(board.archived_at))
        .orderBy(({ board }) => board.position),
  })
  const { data: archived } = useLiveQuery({
    query: (q) =>
      q.from({ board: boardsCollection }).where(({ board }) => not(isNull(board.archived_at))),
  })
  // The loader redirects only on arrival. A board can open while this page is
  // up (restored from the sidebar, or an archive that failed and rolled back),
  // so go to it the same way, without showing the outdated message meanwhile.
  const nextId = boardToOpen(openBoards)?.id
  useEffect(() => {
    if (nextId) void navigate({ to: '/b/$boardId', params: { boardId: nextId }, replace: true })
  }, [nextId, navigate])
  if (nextId) return null
  return (
    <div className="flex min-h-svh flex-col px-4 py-5 sm:px-7">
      {/* Phones: the sidebar is off-canvas, and the copy below points people to it. */}
      <header className="flex md:hidden">
        <SidebarTrigger className="-ml-1.5" />
      </header>
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <KanbanIcon />
          </EmptyMedia>
          <EmptyTitle>{archived.length > 0 ? 'No open boards' : 'No boards yet'}</EmptyTitle>
          <EmptyDescription>
            {archived.length > 0
              ? 'Every board is archived. Restore one from Archived in the sidebar, or start a new one.'
              : 'A board holds columns of cards. Make one per thing you track.'}
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
    </div>
  )
}
