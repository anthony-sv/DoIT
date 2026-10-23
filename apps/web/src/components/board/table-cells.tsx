// The table's cells edit in place: flat triggers that read as a grid until
// they're used, then open a menu (or a calendar). Writes go through
// card-writes.ts, as in the card sheet.
import { useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarIcon, XIcon } from 'lucide-react'
import { assigneeEmail, setAssignee, updateCard } from '@/components/card/card-writes'
import { PersonAvatar } from '@/components/person-avatar'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { type Card, type Column, type Priority, type Story, priorities } from '@/data/schemas'
import type { BoardPerson } from '@/hooks/use-board-people'
import { colorClasses } from '@/lib/colors'
import { dueInfo, priorityNames } from '@/lib/format'
import { cn } from '@/lib/utils'

// Menu values can't be null; this stands for "none".
const NONE = 'none'

// A ghost button as wide as its cell.
const trigger = 'w-full justify-start'
// At least as wide as the cell that opened it; long names are cut short.
const menu = 'w-auto max-w-80 min-w-(--anchor-width)'

function Unset() {
  return <span className="text-muted-foreground">—</span>
}

export function AssigneeCell({
  card,
  cardKey,
  people,
}: {
  card: Card
  cardKey: string
  people: BoardPerson[]
}) {
  const email = card.assignee_id ? assigneeEmail(people, card.assignee_id) : null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={trigger}
            aria-label={`Assignee of ${cardKey}: ${email ?? 'unassigned'}`}
          />
        }
      >
        {email ? (
          <>
            <PersonAvatar email={email} className="size-5" />
            <span className="truncate">{email}</span>
          </>
        ) : (
          <Unset />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className={menu}>
        <DropdownMenuRadioGroup
          value={card.assignee_id ?? NONE}
          onValueChange={(value: string) =>
            setAssignee(card, people, value === NONE ? null : value)
          }
        >
          <DropdownMenuRadioItem value={NONE} closeOnClick>
            Unassigned
          </DropdownMenuRadioItem>
          {people.map((person) => (
            <DropdownMenuRadioItem key={person.userId} value={person.userId} closeOnClick>
              <PersonAvatar email={person.email} className="size-5" />
              <span className="truncate">{person.email}</span>
              {person.isYou ? <span className="text-muted-foreground">(you)</span> : null}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The card's column, as a cell filled with that column's color. Choosing
 * another moves the row to that column's group; `claimFocus` says whether
 * this cell, just mounted there, should take focus.
 */
export function StatusCell({
  card,
  cardKey,
  column,
  columns,
  onChange,
  claimFocus,
}: {
  card: Card
  cardKey: string
  column: Column
  columns: Column[]
  onChange: (columnId: string) => void
  claimFocus: (cardId: string, columnId: string) => boolean
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (claimFocus(card.id, column.id)) triggerRef.current?.focus()
  }, [claimFocus, card.id, column.id])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        ref={triggerRef}
        render={
          <Button
            variant="ghost"
            size="sm"
            className="w-full p-0"
            aria-label={`Status of ${cardKey}: ${column.name}`}
          />
        }
      >
        {/* The fill sits on its own span, so the ghost button's hover
            color can't replace it; a ring in the text color marks hover. */}
        <span
          className={cn(
            'flex size-full min-w-0 items-center justify-center rounded-[inherit] px-2.5 ring-current/30 ring-inset group-hover/button:ring-1 group-aria-expanded/button:ring-1',
            colorClasses[column.color].chip,
          )}
        >
          <span className="truncate">{column.name}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className={menu}>
        <DropdownMenuRadioGroup
          value={card.column_id}
          onValueChange={(id: string) => onChange(id)}
        >
          {columns.map((c) => (
            <DropdownMenuRadioItem key={c.id} value={c.id} closeOnClick>
              <span className={cn('size-2.5 shrink-0 rounded-full', colorClasses[c.color].dot)} />
              <span className="truncate">{c.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function PriorityCell({ card, cardKey }: { card: Card; cardKey: string }) {
  const urgent = card.priority === 'high' || card.priority === 'urgent'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={trigger}
            aria-label={`Priority of ${cardKey}: ${priorityNames[card.priority]}`}
          />
        }
      >
        <span className={cn(urgent ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
          {priorityNames[card.priority]}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className={menu}>
        <DropdownMenuRadioGroup
          value={card.priority}
          onValueChange={(priority: Priority) => {
            if (priority === card.priority) return
            updateCard(card.id, 'Priority not saved', (d) => {
              d.priority = priority
            })
          }}
        >
          {priorities.map((p) => (
            <DropdownMenuRadioItem key={p} value={p} closeOnClick>
              {priorityNames[p]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Overdue and soon read like the due chip on a card tile. */
export function DueCell({ card, cardKey, done }: { card: Card; cardKey: string; done: boolean }) {
  const [open, setOpen] = useState(false)
  const due = card.due_on ? dueInfo(card.due_on, done) : null
  const selected = card.due_on ? parseISO(card.due_on) : undefined

  function setDue(date: Date | undefined) {
    setOpen(false)
    const dueOn = date ? format(date, 'yyyy-MM-dd') : null
    if (dueOn === card.due_on) return
    updateCard(card.id, 'Due date not saved', (d) => {
      d.due_on = dueOn
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={trigger}
            aria-label={`Due date of ${cardKey}: ${due?.label ?? 'none'}`}
          />
        }
      >
        {due ? (
          <span
            className={cn(
              'flex items-center gap-1 rounded-md text-xs',
              due.state === 'overdue' &&
                'bg-label-red px-1.5 py-0.5 font-medium text-label-red-foreground',
              due.state === 'soon' &&
                'bg-label-amber px-1.5 py-0.5 font-medium text-label-amber-foreground',
            )}
          >
            {due.state === 'later' ? <CalendarIcon data-icon="inline-start" /> : null}
            {due.label}
          </span>
        ) : (
          <Unset />
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto gap-0 p-0" align="start">
        <Calendar mode="single" selected={selected} defaultMonth={selected} onSelect={setDue} />
        {card.due_on ? (
          <>
            <Separator />
            <div className="p-1">
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setDue(undefined)}>
                <XIcon data-icon="inline-start" />
                Clear due date
              </Button>
            </div>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

export function StoryCell({
  card,
  cardKey,
  stories,
}: {
  card: Card
  cardKey: string
  stories: Story[]
}) {
  const title = card.story_id
    ? (stories.find((s) => s.id === card.story_id)?.title ?? 'Deleted story')
    : null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={trigger}
            aria-label={`Story of ${cardKey}: ${title ?? 'none'}`}
          />
        }
      >
        {title ? <span className="truncate">{title}</span> : <Unset />}
      </DropdownMenuTrigger>
      <DropdownMenuContent className={menu}>
        <DropdownMenuRadioGroup
          value={card.story_id ?? NONE}
          onValueChange={(value: string) => {
            const storyId = value === NONE ? null : value
            if (storyId === card.story_id) return
            updateCard(card.id, 'Story not saved', (d) => {
              d.story_id = storyId
            })
          }}
        >
          <DropdownMenuRadioItem value={NONE} closeOnClick>
            No story
          </DropdownMenuRadioItem>
          {stories.map((story) => (
            <DropdownMenuRadioItem key={story.id} value={story.id} closeOnClick>
              <span className="truncate">{story.title}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
