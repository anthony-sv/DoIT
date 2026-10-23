import { useCallback, useId, useRef, useState } from 'react'
import { ChevronRightIcon } from 'lucide-react'
import { EstimateInput } from '@/components/card/card-fields'
import { moveToColumn } from '@/components/card/card-writes'
import { LabelPicker } from '@/components/card/label-picker'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Board, Card, Column, Label, LabelColor, Story } from '@/data/schemas'
import { type BoardPerson, useBoardPeople } from '@/hooks/use-board-people'
import { colorClasses } from '@/lib/colors'
import { cardKey, daysLabel } from '@/lib/format'
import { groupByColumn, totalEstimate } from '@/lib/status-groups'
import { cn } from '@/lib/utils'
import { TableAddCard } from './table-add-card'
import { AssigneeCell, DueCell, PriorityCell, StatusCell, StoryCell } from './table-cells'
import type { BoardViewProps } from './view-props'

// Fixed widths keep the columns of every group in line. The card column takes
// what's left; under the table's minimum width the table scrolls sideways.
// The minimum fits beside the sidebar on a 1440px screen.
// Headings are padded to line up with the text of the buttons in the cells.
const headings = [
  { name: 'Card', width: undefined },
  { name: 'Assignee', width: 'w-40' },
  { name: 'Status', width: 'w-28' },
  { name: 'Priority', width: 'w-24' },
  { name: 'Due', width: 'w-34' },
  { name: 'Estimate', width: 'w-28' },
  { name: 'Story', width: 'w-36' },
  { name: 'Labels', width: 'w-36' },
]

// Static class names so Tailwind sees them.
const titleColors: Record<LabelColor, string> = {
  blue: 'text-label-blue-foreground',
  purple: 'text-label-purple-foreground',
  teal: 'text-label-teal-foreground',
  red: 'text-label-red-foreground',
  amber: 'text-label-amber-foreground',
  green: 'text-label-green-foreground',
  gray: 'text-label-gray-foreground',
}

/** The board as a table, one group of rows per column (status). */
export function BoardTable({
  board,
  columns,
  cards,
  labels,
  stories,
  sprintId,
  onOpenCard,
}: BoardViewProps) {
  const people = useBoardPeople(board)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())

  // A new status moves the card's row to another group, where React mounts it
  // afresh: the trigger the menu would give focus back to is gone, and focus
  // would drop to the page. The row's new status cell claims it instead.
  const landing = useRef<{ cardId: string; columnId: string } | null>(null)
  const claimFocus = useCallback((cardId: string, columnId: string) => {
    const pending = landing.current
    if (pending?.cardId !== cardId || pending.columnId !== columnId) return false
    landing.current = null
    return true
  }, [])

  function setOpen(columnId: string, open: boolean) {
    setCollapsed((prev) => {
      const isOpen = !prev.has(columnId)
      if (isOpen === open) return prev
      const next = new Set(prev)
      if (open) next.delete(columnId)
      else next.add(columnId)
      return next
    })
  }

  function changeStatus(card: Card, toId: string) {
    if (toId === card.column_id) return
    landing.current = { cardId: card.id, columnId: toId }
    // A collapsed group would hide the card it just got.
    setOpen(toId, true)
    moveToColumn(card, columns, toId)
  }

  return (
    <div className="flex flex-col gap-6">
      {groupByColumn(columns, cards).map(({ column, cards }) => (
        <StatusGroup
          key={column.id}
          board={board}
          column={column}
          columns={columns}
          cards={cards}
          labels={labels}
          stories={stories}
          people={people}
          sprintId={sprintId}
          open={!collapsed.has(column.id)}
          onOpenChange={(open) => setOpen(column.id, open)}
          onChangeStatus={changeStatus}
          claimFocus={claimFocus}
          onOpenCard={onOpenCard}
        />
      ))}
    </div>
  )
}

/** What a row needs to change a card's status and keep focus on it. */
interface StatusChange {
  onChangeStatus: (card: Card, toId: string) => void
  claimFocus: (cardId: string, columnId: string) => boolean
}

function StatusGroup({
  board,
  column,
  columns,
  cards,
  labels,
  stories,
  people,
  sprintId,
  open,
  onOpenChange,
  onChangeStatus,
  claimFocus,
  onOpenCard,
}: StatusChange & {
  board: Board
  column: Column
  columns: Column[]
  cards: Card[]
  labels: Label[]
  stories: Story[]
  people: BoardPerson[]
  sprintId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenCard: (id: string) => void
}) {
  const headingId = useId()
  const estimate = totalEstimate(cards)

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="flex flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={open ? `Collapse ${column.name}` : `Expand ${column.name}`}
            />
          }
        >
          <ChevronRightIcon className="transition-transform group-data-panel-open/button:rotate-90" />
        </CollapsibleTrigger>
        <h2 id={headingId} className={cn('truncate text-sm font-semibold', titleColors[column.color])}>
          {column.name}
        </h2>
        <span className="shrink-0 text-xs text-muted-foreground">
          {cards.length} {cards.length === 1 ? 'card' : 'cards'}
          {estimate !== null ? ` · ${daysLabel(estimate, 'long')} estimated` : null}
        </span>
      </div>

      <CollapsibleContent>
        <div className="flex overflow-hidden rounded-lg border">
          {/* The group's color down its left edge; it stays put when the table scrolls. */}
          <span aria-hidden className={cn('w-1.5 shrink-0', colorClasses[column.color].dot)} />
          <Table
            aria-labelledby={headingId}
            className="min-w-[1100px] table-fixed [&_td+td]:border-l [&_th+th]:border-l"
          >
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {headings.map((h) => (
                  <TableHead key={h.name} className={cn('px-3.5', h.width)}>
                    {h.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map((card) => (
                <CardRow
                  key={card.id}
                  board={board}
                  card={card}
                  column={column}
                  columns={columns}
                  labels={labels}
                  stories={stories}
                  people={people}
                  onChangeStatus={onChangeStatus}
                  claimFocus={claimFocus}
                  onOpenCard={onOpenCard}
                />
              ))}
              <TableAddCard
                board={board}
                column={column}
                sprintId={sprintId}
                colSpan={headings.length}
              />
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function CardRow({
  board,
  card,
  column,
  columns,
  labels,
  stories,
  people,
  onChangeStatus,
  claimFocus,
  onOpenCard,
}: StatusChange & {
  board: Board
  card: Card
  column: Column
  columns: Column[]
  labels: Label[]
  stories: Story[]
  people: BoardPerson[]
  onOpenCard: (id: string) => void
}) {
  const key = cardKey(board.key, card.number)
  return (
    <TableRow>
      <TableCell className="p-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => onOpenCard(card.id)}
        >
          <span className="font-mono text-xs text-muted-foreground">{key}</span>
          <span className={cn('truncate', column.is_done && 'text-muted-foreground')}>
            {card.title}
          </span>
        </Button>
      </TableCell>
      <TableCell className="p-1">
        <AssigneeCell card={card} cardKey={key} people={people} />
      </TableCell>
      <TableCell className="p-1">
        <StatusCell
          card={card}
          cardKey={key}
          column={column}
          columns={columns}
          onChange={(toId) => onChangeStatus(card, toId)}
          claimFocus={claimFocus}
        />
      </TableCell>
      <TableCell className="p-1">
        <PriorityCell card={card} cardKey={key} />
      </TableCell>
      <TableCell className="p-1">
        <DueCell card={card} cardKey={key} done={column.is_done} />
      </TableCell>
      <TableCell className="p-1">
        {/* The group names the card; the input's own label says "Estimate in days". */}
        <div role="group" aria-label={`Estimate of ${key}`}>
          {/* Borderless until hovered or focused, like the other cells. */}
          <EstimateInput card={card} className="w-full border-transparent hover:border-input" />
        </div>
      </TableCell>
      <TableCell className="p-1">
        <StoryCell card={card} cardKey={key} stories={stories} />
      </TableCell>
      <TableCell className="px-3.5 py-1">
        <div role="group" aria-label={`Labels of ${key}`}>
          <LabelPicker card={card} boardId={board.id} labels={labels} />
        </div>
      </TableCell>
    </TableRow>
  )
}
