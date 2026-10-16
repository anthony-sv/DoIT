import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { count, eq, isNull, useLiveQuery } from '@tanstack/react-db'
import {
  CheckIcon,
  CircleCheckIcon,
  InboxIcon,
  KanbanIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SunIcon,
} from 'lucide-react'
import { NewBoardDialog } from '@/components/new-board-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { boardsCollection, cardsCollection, todosCollection } from '@/data/collections'
import { currentUserEmail, signOut } from '@/lib/auth'
import { colorClasses } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { type Theme, applyTheme, readTheme } from '@/lib/theme'
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
  const currentBoard = boards.find((b) => b.id === boardId) ?? boards[0]

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
                    <span className="truncate">{board.name}</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>{countFor(board.id)}</SidebarMenuBadge>
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
      </SidebarContent>

      <SidebarFooter>
        <AccountMenu />
      </SidebarFooter>

      <NewBoardDialog open={newBoardOpen} onOpenChange={setNewBoardOpen} />
    </Sidebar>
  )
}

function AccountMenu() {
  const [theme, setTheme] = useState<Theme>(readTheme)
  const email = currentUserEmail()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background uppercase">
              {email.slice(0, 2)}
            </span>
            <span className="truncate text-sm">{email}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(value: Theme) => {
                  setTheme(value)
                  applyTheme(value)
                }}
              >
                <DropdownMenuRadioItem value="light">
                  <SunIcon />
                  Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <MoonIcon />
                  Dark
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  <MonitorIcon />
                  System
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => void signOut()}>
                <LogOutIcon />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
