import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { count, eq, isNull, not, useLiveQuery } from '@tanstack/react-db'
import {
  ArchiveIcon,
  CheckIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  InboxIcon,
  KanbanIcon,
  PlusIcon,
  SearchIcon,
} from 'lucide-react'
import { AccountMenu } from '@/components/account-menu'
import { BoardMenu } from '@/components/board/board-menu'
import { CanvasesGroup } from '@/components/canvas/canvases-group'
import { NewBoardDialog } from '@/components/new-board-dialog'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Kbd } from '@/components/ui/kbd'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { boardsCollection, cardsCollection, todosCollection } from '@/data/collections'
import type { Board } from '@/data/schemas'
import { colorClasses } from '@/lib/colors'
import { readLastBoard } from '@/lib/last-board'
import { cn } from '@/lib/utils'
import { openCommandPalette } from './command-palette'

export function AppSidebar() {
  const { boardId } = useParams({ strict: false })
  const [newBoardOpen, setNewBoardOpen] = useState(false)

  const { data: boards } = useLiveQuery({
    query: (q) =>
      q
        .from({ board: boardsCollection })
        .where(({ board }) => isNull(board.archived_at))
        .orderBy(({ board }) => board.position),
  })
  const { data: archived } = useLiveQuery({
    query: (q) =>
      q
        .from({ board: boardsCollection })
        .where(({ board }) => not(isNull(board.archived_at)))
        .orderBy(({ board }) => board.archived_at, 'desc'),
  })
  const { data: openCounts } = useLiveQuery({
    query: (q) =>
      q
        .from({ card: cardsCollection })
        .where(({ card }) => isNull(card.completed_at))
        .groupBy(({ card }) => card.board_id)
        .select(({ card }) => ({ board_id: card.board_id, open: count(card.id) })),
  })
  const { data: openTodos } = useLiveQuery({
    query: (q) =>
      q
        .from({ todo: todosCollection })
        .where(({ todo }) => eq(todo.done, false))
        .select(({ todo }) => ({ n: count(todo.id) })),
  })
  const countFor = (id: string) => openCounts.find((c) => c.board_id === id)?.open ?? 0
  const todoCount = openTodos[0]?.n ?? 0
  // On a board, that board, archived or not. Off one (todos, canvases), the
  // open board you came from.
  const currentBoard =
    [...boards, ...archived].find((b) => b.id === boardId) ??
    boards.find((b) => b.id === readLastBoard()) ??
    boards[0]

  return (
    <Sidebar>
      <SidebarHeader className="gap-3">
        <Link to="/" className="flex items-center gap-2.5 px-2 pt-1">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CheckIcon className="size-4" />
          </span>
          <span className="text-base font-bold tracking-tight">DoIT</span>
        </Link>
        <Button
          variant="outline"
          className="justify-start text-muted-foreground"
          onClick={openCommandPalette}
        >
          <SearchIcon data-icon="inline-start" />
          <span className="flex-1 text-left">Search</span>
          <Kbd>Ctrl K</Kbd>
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Boards</SidebarGroupLabel>
          <SidebarGroupAction title="New board" onClick={() => setNewBoardOpen(true)}>
            <PlusIcon />
            <span className="sr-only">New board</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {boards.map((board) => (
                <SidebarMenuItem key={board.id}>
                  <SidebarMenuButton
                    isActive={board.id === boardId}
                    render={<Link to="/b/$boardId" params={{ boardId: board.id }} />}
                  >
                    <span className={cn('size-2 shrink-0 rounded-[2px]', colorClasses[board.color].dot)} />
                    {/* Room for the count, which sits left of the options button on
                        phones and touch screens. */}
                    <span className="truncate max-md:mr-7 pointer-coarse:mr-7">{board.name}</span>
                  </SidebarMenuButton>
                  {/* Gives way to the options button (hover, focus, menu open); phones
                      and touch screens always show that button, so there the count
                      moves left of it. */}
                  <SidebarMenuBadge className="max-md:right-7 md:group-focus-within/menu-item:hidden md:group-hover/menu-item:hidden md:group-has-aria-expanded/menu-item:hidden pointer-coarse:right-7">
                    {countFor(board.id)}
                  </SidebarMenuBadge>
                  {/* Touch screens can't hover, so there it always shows, with the
                      larger tap target phones get. */}
                  <BoardMenu
                    board={board}
                    trigger={
                      <SidebarMenuAction
                        showOnHover
                        className="pointer-coarse:opacity-100 pointer-coarse:after:block"
                      />
                    }
                  />
                </SidebarMenuItem>
              ))}
              {boards.length === 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => setNewBoardOpen(true)}>
                    <PlusIcon />
                    Create your first board
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              {archived.length > 0 ? (
                <ArchivedBoards boards={archived} activeId={boardId} />
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Plan</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {currentBoard ? (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<Link to="/b/$boardId" params={{ boardId: currentBoard.id }} />}
                    >
                      <KanbanIcon />
                      <span className="truncate">{currentBoard.name} board</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={
                        <Link
                          to="/b/$boardId/plan"
                          params={{ boardId: currentBoard.id }}
                          activeProps={{ 'data-active': true }}
                        />
                      }
                    >
                      <InboxIcon />
                      Backlog &amp; sprints
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              ) : null}
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link to="/todos" activeProps={{ 'data-active': true }} />}
                >
                  <CircleCheckIcon />
                  My todos
                </SidebarMenuButton>
                {todoCount > 0 ? <SidebarMenuBadge>{todoCount}</SidebarMenuBadge> : null}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <CanvasesGroup />
      </SidebarContent>

      <SidebarFooter>
        <AccountMenu />
      </SidebarFooter>

      <NewBoardDialog open={newBoardOpen} onOpenChange={setNewBoardOpen} />
    </Sidebar>
  )
}

function ArchivedBoards({ boards, activeId }: { boards: Board[]; activeId: string | undefined }) {
  return (
    <Collapsible
      render={<SidebarMenuItem />}
      defaultOpen={boards.some((b) => b.id === activeId)}
    >
      <CollapsibleTrigger
        render={
          // The rows' option buttons sit inside this item too; without the
          // override the button would make room for one and its chevron jump.
          <SidebarMenuButton className="group-has-data-[sidebar=menu-action]/menu-item:pr-2" />
        }
      >
        <ArchiveIcon />
        <span>Archived ({boards.length})</span>
        <ChevronRightIcon className="ml-auto transition-transform group-data-panel-open/menu-button:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub>
          {boards.map((board) => (
            <SidebarMenuSubItem key={board.id}>
              <SidebarMenuSubButton
                isActive={board.id === activeId}
                className="pr-8"
                render={<Link to="/b/$boardId" params={{ boardId: board.id }} />}
              >
                <span className={cn('size-2 shrink-0 rounded-[2px]', colorClasses[board.color].dot)} />
                <span>{board.name}</span>
              </SidebarMenuSubButton>
              <BoardMenu
                board={board}
                trigger={
                  // showOnHover keys off the outer item, which would reveal
                  // every row's button at once; this keys off the row. Touch
                  // screens always show it, as for open boards.
                  <SidebarMenuAction className="top-1 group-focus-within/menu-sub-item:opacity-100 group-hover/menu-sub-item:opacity-100 aria-expanded:opacity-100 md:opacity-0 pointer-coarse:opacity-100 pointer-coarse:after:block" />
                }
              />
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}
