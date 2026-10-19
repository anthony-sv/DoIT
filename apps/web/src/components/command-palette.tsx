import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useHotkey } from '@tanstack/react-hotkeys'
import { eq, isNull, useLiveQuery } from '@tanstack/react-db'
import { CircleCheckIcon, KanbanIcon } from 'lucide-react'
import { kindIcons, kindLabels } from '@/components/canvas/canvas-ui'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { boardsCollection, canvasesCollection, cardsCollection } from '@/data/collections'
import { cardKey } from '@/lib/format'
import { colorClasses } from '@/lib/colors'
import { cn } from '@/lib/utils'

const OPEN_EVENT = 'doit:open-command-palette'

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

// Excalidraw binds Mod+K to "add link" and gets the key first (React's
// listener on the document predates this hotkey's), so while focus is in a
// whiteboard the palette leaves the key to it. Search in the sidebar still opens it.
function inWhiteboard(event: KeyboardEvent) {
  return event.target instanceof Element && event.target.closest('.excalidraw') !== null
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useHotkey(
    'Mod+K',
    (event) => {
      if (!inWhiteboard(event)) setOpen((o) => !o)
    },
    { ignoreInputs: false },
  )
  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, show)
    return () => window.removeEventListener(OPEN_EVENT, show)
  }, [])

  const { data: boards } = useLiveQuery({
    query: (q) =>
      q
        .from({ board: boardsCollection })
        .where(({ board }) => isNull(board.archived_at))
        .orderBy(({ board }) => board.position),
  })
  const { data: canvases } = useLiveQuery({
    query: (q) => q.from({ canvas: canvasesCollection }).orderBy(({ canvas }) => canvas.position),
  })
  const { data: cards } = useLiveQuery({
    query: (q) =>
      q
        .from({ card: cardsCollection })
        .innerJoin({ board: boardsCollection }, ({ card, board }) => eq(card.board_id, board.id))
        // Archived boards stay out of search, their cards too.
        .where(({ board }) => isNull(board.archived_at))
        .orderBy(({ card }) => card.updated_at, 'desc')
        .select(({ card, board }) => ({
          id: card.id,
          title: card.title,
          number: card.number,
          board_id: board.id,
          board_key: board.key,
          done: card.completed_at,
        })),
  })

  const go = (fn: () => void) => {
    setOpen(false)
    fn()
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search DoIT">
      <Command>
        <CommandInput placeholder="Find a board, drawing or card…" />
        <CommandList>
          <CommandEmpty>Nothing matches.</CommandEmpty>
          <CommandGroup heading="Boards">
            {boards.map((board) => (
              <CommandItem
                key={board.id}
                value={`board ${board.name} ${board.key}`}
                onSelect={() =>
                  go(() => void navigate({ to: '/b/$boardId', params: { boardId: board.id } }))
                }
              >
                <span className={cn('size-2 rounded-[2px]', colorClasses[board.color].dot)} />
                {board.name}
                <KanbanIcon className="ml-auto text-muted-foreground" />
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Drawings">
            {canvases.map((canvas) => {
              const Icon = kindIcons[canvas.kind]
              return (
                <CommandItem
                  key={canvas.id}
                  value={`drawing ${kindLabels[canvas.kind]} ${canvas.name} ${canvas.id}`}
                  onSelect={() =>
                    go(
                      () =>
                        void navigate({ to: '/c/$canvasId', params: { canvasId: canvas.id } }),
                    )
                  }
                >
                  <Icon className="text-muted-foreground" />
                  <span className="truncate">{canvas.name}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
          <CommandGroup heading="Cards">
            {cards.slice(0, 200).map((card) => {
              const key = cardKey(card.board_key, card.number)
              return (
                <CommandItem
                  key={card.id}
                  value={`${key} ${card.title} ${card.id}`}
                  onSelect={() =>
                    go(
                      () =>
                        void navigate({
                          to: '/b/$boardId',
                          params: { boardId: card.board_id },
                          search: { card: card.id },
                        }),
                    )
                  }
                >
                  <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{key}</span>
                  <span className="truncate">{card.title}</span>
                  {card.done ? <CircleCheckIcon className="ml-auto text-muted-foreground" /> : null}
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
