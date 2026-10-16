import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useHotkey } from '@tanstack/react-hotkeys'
import { eq, isNull, useLiveQuery } from '@tanstack/react-db'
import { CircleCheckIcon, KanbanIcon } from 'lucide-react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { boardsCollection, cardsCollection } from '@/data/collections'
import { cardKey } from '@/lib/format'
import { colorClasses } from '@/lib/colors'
import { cn } from '@/lib/utils'

const OPEN_EVENT = 'doit:open-command-palette'

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useHotkey('Mod+K', () => setOpen((o) => !o), { ignoreInputs: false })
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
  const { data: cards } = useLiveQuery({
    query: (q) =>
      q
        .from({ card: cardsCollection })
        .innerJoin({ board: boardsCollection }, ({ card, board }) => eq(card.board_id, board.id))
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
        <CommandInput placeholder="Find a board or card…" />
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
