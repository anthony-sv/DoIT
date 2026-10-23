import type { Board, Card, Column, Todo } from '@/data/schemas'
import { cardKey } from './format'
import { positionBetween } from './position'

/** The list of todos without a section. */
export const INBOX = 'inbox'

/**
 * Todo ids per list (the inbox and each section), keeping the order of
 * `todos`. A todo whose section is gone shows in the inbox, which is where
 * Postgres puts it.
 */
export function todoLists(
  sectionIds: readonly string[],
  todos: ReadonlyArray<Pick<Todo, 'id' | 'section_id'>>,
): Record<string, string[]> {
  const lists: Record<string, string[]> = { [INBOX]: [] }
  for (const id of sectionIds) lists[id] = []
  for (const todo of todos) (lists[todo.section_id ?? INBOX] ?? lists[INBOX]!).push(todo.id)
  return lists
}

/**
 * Position for a todo dropped between the open todos at `before` and `after`
 * (missing at an end of the list). The list's completed todos, at `done`,
 * share its positions without showing among the open ones, so it lands after
 * any in that gap rather than on or among them, where unchecking one would
 * bring it back in a tie or at an arbitrary spot.
 */
export function positionBetweenOpen(
  before: number | undefined,
  after: number | undefined,
  done: readonly number[],
): number {
  const hidden = done.filter(
    (p) => (before === undefined || p > before) && (after === undefined || p < after),
  )
  return positionBetween(hidden.length > 0 ? Math.max(...hidden) : before, after)
}

// The lists (section ids, or INBOX) folded away on the todos page.
const COLLAPSED = 'doit-collapsed-todo-lists'

export function readCollapsed(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(COLLAPSED) ?? '[]')
    return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function rememberCollapsed(ids: readonly string[]) {
  try {
    if (ids.length === 0) localStorage.removeItem(COLLAPSED)
    else localStorage.setItem(COLLAPSED, JSON.stringify(ids))
  } catch {
    // Storage blocked: every section starts open after a reload.
  }
}

export type AssignedCard = { card: Card; key: string; imported: boolean }
export type AssignedBoard = { board: Board; cards: AssignedCard[] }

/**
 * The cards assigned to `userId` that are still to do, by board, for the
 * import dialog. Archived boards and cards in a done column are left out.
 * Your boards come in sidebar order, then shared ones by name; within a
 * board, the soonest due first (no date last), then by number. `imported`
 * marks a card one of your todos came from, done or not.
 */
export function assignedCards({
  userId,
  boards,
  columns,
  cards,
  todos,
}: {
  userId: string
  boards: readonly Board[]
  columns: ReadonlyArray<Pick<Column, 'id' | 'is_done'>>
  cards: readonly Card[]
  todos: ReadonlyArray<Pick<Todo, 'card_id'>>
}): AssignedBoard[] {
  const doneColumns = new Set(columns.filter((c) => c.is_done).map((c) => c.id))
  const imported = new Set(todos.map((t) => t.card_id))
  const byBoard = new Map<string, Card[]>()
  for (const card of cards) {
    if (card.assignee_id !== userId || doneColumns.has(card.column_id)) continue
    const list = byBoard.get(card.board_id)
    if (list) list.push(card)
    else byBoard.set(card.board_id, [card])
  }
  return boards
    .filter((b) => b.archived_at === null && byBoard.has(b.id))
    .sort(boardOrder(userId))
    .map((board) => ({
      board,
      cards: byBoard
        .get(board.id)!
        .sort(byDueThenNumber)
        .map((card) => ({
          card,
          key: cardKey(board.key, card.number),
          imported: imported.has(card.id),
        })),
    }))
}

// As in the sidebar: yours by position, then shared ones by name (their
// position is their owner's order).
function boardOrder(userId: string) {
  return (a: Board, b: Board) => {
    const mine = Number(b.owner_id === userId) - Number(a.owner_id === userId)
    if (mine !== 0) return mine
    return a.owner_id === userId ? a.position - b.position : a.name.localeCompare(b.name)
  }
}

function byDueThenNumber(a: Card, b: Card) {
  if (a.due_on !== b.due_on) {
    if (a.due_on === null) return 1
    if (b.due_on === null) return -1
    return a.due_on < b.due_on ? -1 : 1
  }
  return a.number - b.number
}

/**
 * The cards to import, in the order the dialog lists them: every one not
 * imported yet, less those the user unticked (`skipped`). Tracking what was
 * unticked rather than what is ticked keeps a card that shows up while the
 * dialog is open selected, like the rest started.
 */
export function cardsToImport(
  groups: readonly AssignedBoard[],
  skipped: ReadonlySet<string>,
): AssignedCard[] {
  return groups.flatMap((g) => g.cards.filter((c) => !c.imported && !skipped.has(c.card.id)))
}
