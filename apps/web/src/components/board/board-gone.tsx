import { Link } from '@tanstack/react-router'
import { KanbanIcon } from 'lucide-react'
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

/**
 * A board page whose board isn't here: a bad link, or a shared board that its
 * owner deleted or took you off while you had it open.
 */
export function BoardGone() {
  return (
    <div className="flex min-h-svh flex-col px-4 py-5 sm:px-7">
      <SidebarTrigger className="-ml-1.5 md:hidden" />
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <KanbanIcon />
          </EmptyMedia>
          <EmptyTitle>This board isn’t available</EmptyTitle>
          <EmptyDescription>
            It may have been deleted, or its owner stopped sharing it with you.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button nativeButton={false} render={<Link to="/" />}>
            Go to your boards
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
