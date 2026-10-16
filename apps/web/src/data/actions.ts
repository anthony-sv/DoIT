// Writes that touch more than one row or table. Single-row edits call the
// collections directly (collection.update / insert / delete).
import { createOptimisticAction } from '@tanstack/react-db'
import { addDays, format } from 'date-fns'
import { currentUserId } from '@/lib/auth'
import { positionAfterLast } from '@/lib/position'
import { supabase } from '@/lib/supabase'
import {
  boardsCollection,
  cardEventsCollection,
  cardsCollection,
  columnsCollection,
  sprintsCollection,
} from './collections'
import type { Board, Card, Column, LabelColor, Sprint } from './schemas'

const now = () => new Date().toISOString()
export const today = () => format(new Date(), 'yyyy-MM-dd')

async function check<T extends { error: { message: string } | null }>(request: PromiseLike<T>) {
  const result = await request
  if (result.error) throw new Error(result.error.message)
  return result
}

const defaultColumns: Array<Pick<Column, 'name' | 'color' | 'is_done'>> = [
  { name: 'To do', color: 'gray', is_done: false },
  { name: 'In progress', color: 'blue', is_done: false },
  { name: 'Review', color: 'amber', is_done: false },
  { name: 'Done', color: 'green', is_done: true },
]

export function newBoard(input: {
  name: string
  key: string
  color: LabelColor
  position: number
}): { board: Board; columns: Column[] } {
  const owner_id = currentUserId()
  const board: Board = {
    id: crypto.randomUUID(),
    owner_id,
    name: input.name.trim(),
    key: input.key,
    color: input.color,
    position: input.position,
    next_number: 1,
    archived_at: null,
    created_at: now(),
  }
  const columns = defaultColumns.map((c, i) => ({
    ...c,
    id: crypto.randomUUID(),
    owner_id,
    board_id: board.id,
    position: (i + 1) * 1024,
    wip_limit: null,
    created_at: now(),
  }))
  return { board, columns }
}

/** A board with the four default columns; the columns wait for the board row. */
export const createBoard = createOptimisticAction<ReturnType<typeof newBoard>>({
  onMutate: ({ board, columns }) => {
    boardsCollection.insert(board)
    columnsCollection.insert(columns)
  },
  mutationFn: async ({ board, columns }) => {
    const { created_at: _b, next_number: _n, ...boardRow } = board
    await check(supabase.from('boards').insert(boardRow))
    await check(
      supabase.from('columns').insert(columns.map(({ created_at: _c, ...row }) => row)),
    )
    await Promise.all([boardsCollection.utils.refetch(), columnsCollection.utils.refetch()])
  },
})

/** Suggest a card prefix from a board name: "Devscope" → "DEV", "Do It" → "DI". */
export function suggestBoardKey(name: string): string {
  const words = name.toUpperCase().match(/[A-Z0-9]+/g) ?? []
  const key = words.length > 1 ? words.map((w) => w[0]).join('') : (words[0] ?? '')
  return (/^[A-Z]/.test(key) ? key : `B${key}`).slice(0, 4) || 'CARD'
}

export function addCard(input: {
  board: Board
  column: Column
  title: string
  sprintId: string | null
  position: number
  backlogPosition: number
}) {
  const card: Card = {
    id: crypto.randomUUID(),
    owner_id: currentUserId(),
    board_id: input.board.id,
    column_id: input.column.id,
    sprint_id: input.sprintId,
    number: 0,
    title: input.title.trim(),
    description: '',
    priority: 'medium',
    due_on: null,
    label_ids: [],
    position: input.position,
    backlog_position: input.backlogPosition,
    completed_at: input.column.is_done ? now() : null,
    created_at: now(),
    updated_at: now(),
  }
  return cardsCollection.insert(card)
}

export function logEvent(cardId: string, kind: string, body: string) {
  cardEventsCollection.insert({
    id: crypto.randomUUID(),
    owner_id: currentUserId(),
    card_id: cardId,
    kind,
    body,
    created_at: now(),
  })
}

/** Move a card on the board: new column and/or new place inside it. */
export function moveCard(card: Card, from: Column, to: Column, position: number) {
  const tx = cardsCollection.update(card.id, (draft) => {
    draft.column_id = to.id
    draft.position = position
    if (to.is_done && !draft.completed_at) draft.completed_at = now()
    if (!to.is_done) draft.completed_at = null
  })
  if (from.id !== to.id) logEvent(card.id, 'moved', `${from.name} → ${to.name}`)
  return tx
}

/**
 * Delete a column. Its cards would be deleted with it (cascade), so they are
 * moved to the end of `moveTo` first and the delete waits for that to land.
 */
export function removeColumn(column: Column, moveTo: Column | null) {
  // Every card in the column, not just the ones the board is showing.
  const cards = cardsCollection.toArray.filter((c) => c.column_id === column.id)
  const siblings = cardsCollection.toArray
    .filter((c) => moveTo && c.column_id === moveTo.id)
    .map((c) => c.position)
    .sort((a, b) => a - b)
  let position = positionAfterLast(siblings)
  const moves = moveTo
    ? cards.map((c) => {
        const move = { id: c.id, position }
        position += 1024
        return move
      })
    : []
  return deleteColumn({ columnId: column.id, moveToId: moveTo?.id ?? null, moves })
}

const deleteColumn = createOptimisticAction<{
  columnId: string
  moveToId: string | null
  moves: Array<{ id: string; position: number }>
}>({
  onMutate: ({ columnId, moveToId, moves }) => {
    if (moveToId && moves.length > 0) {
      const byId = new Map(moves.map((m) => [m.id, m.position]))
      cardsCollection.update([...byId.keys()], (drafts) => {
        for (const d of drafts) {
          d.column_id = moveToId
          d.position = byId.get(d.id)!
        }
      })
    }
    columnsCollection.delete(columnId)
  },
  mutationFn: async ({ columnId, moveToId, moves }) => {
    if (moveToId) {
      await Promise.all(
        moves.map((m) =>
          check(
            supabase.from('cards').update({ column_id: moveToId, position: m.position }).eq('id', m.id),
          ),
        ),
      )
    }
    await check(supabase.from('columns').delete().eq('id', columnId))
    await Promise.all([cardsCollection.utils.refetch(), columnsCollection.utils.refetch()])
  },
})

// ── Sprints ──────────────────────────────────────────────────────────────

export function nextSprint(board: Board, sprints: Sprint[]): Sprint {
  const last = [...sprints].sort((a, b) => a.ends_on.localeCompare(b.ends_on)).at(-1)
  const start = last ? addDays(new Date(`${last.ends_on}T00:00:00`), 1) : new Date()
  return {
    id: crypto.randomUUID(),
    owner_id: currentUserId(),
    board_id: board.id,
    name: `Sprint ${sprints.length + 1}`,
    goal: '',
    starts_on: format(start, 'yyyy-MM-dd'),
    ends_on: format(addDays(start, 13), 'yyyy-MM-dd'),
    state: 'planned',
    closed_at: null,
    created_at: now(),
  }
}

export function startSprint(sprint: Sprint) {
  return sprintsCollection.update(sprint.id, (draft) => {
    draft.state = 'active'
  })
}

/**
 * Close a sprint. Finished cards stay with it as its record; the rest go back
 * to the backlog or roll into `carryTo`.
 */
export function closeSprint(sprint: Sprint, unfinished: Card[], carryTo: Sprint | null) {
  if (unfinished.length > 0) {
    cardsCollection.update(
      unfinished.map((c) => c.id),
      (drafts) => {
        for (const d of drafts) d.sprint_id = carryTo?.id ?? null
      },
    )
  }
  return sprintsCollection.update(sprint.id, (draft) => {
    draft.state = 'closed'
    draft.closed_at = now()
  })
}
