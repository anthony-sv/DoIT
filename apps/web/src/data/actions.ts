// Writes that touch more than one row or table. Single-row edits call the
// collections directly (collection.update / insert / delete).
import { createOptimisticAction } from '@tanstack/react-db'
import { addDays, format, max, parseISO, startOfToday } from 'date-fns'
import { toast } from '@/components/ui/toast'
import { currentUserId } from '@/lib/auth'
import { positionAfterLast } from '@/lib/position'
import { nextSprintName } from '@/lib/sprints'
import { supabase } from '@/lib/supabase'
import {
  boardMembersCollection,
  boardsCollection,
  cardEventsCollection,
  cardsCollection,
  checklistItemsCollection,
  columnsCollection,
  labelsCollection,
  profilesCollection,
  sprintsCollection,
  storiesCollection,
  todoSectionsCollection,
  todosCollection,
} from './collections'
import type {
  Board,
  BoardMember,
  Card,
  Column,
  Label,
  LabelColor,
  Sprint,
  Story,
  Todo,
  TodoSection,
} from './schemas'

const now = () => new Date().toISOString()
export const today = () => format(new Date(), 'yyyy-MM-dd')

async function check<T extends { error: { message: string } | null }>(request: PromiseLike<T>) {
  const result = await request
  if (result.error) throw new Error(result.error.message)
  return result
}

// Rejects with the first failure, but only after every request has settled,
// so a reload afterwards sees every write that landed.
async function settleAll(requests: Array<Promise<unknown>>) {
  const results = await Promise.allSettled(requests)
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
  if (failed) throw failed.reason
}

type Refetchable = { utils: { refetch: () => Promise<unknown> } }

// Multi-request writes aren't atomic: the requests that land before a failure
// stay in Postgres. Reload on failure too, so the rollback ends on what Postgres
// holds. Not awaited there: the reload retries (and pauses offline), and the
// rollback and its toast shouldn't wait for it.
async function writeThenRefetch(collections: Refetchable[], writes: () => Promise<void>) {
  const refetch = () => Promise.all(collections.map((c) => c.utils.refetch()))
  try {
    await writes()
  } catch (error) {
    void refetch().catch(() => {})
    throw error
  }
  await refetch()
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

/** Archived boards leave the sidebar and search but keep everything on them. */
export function archiveBoard(board: Board, archived: boolean) {
  return boardsCollection.update(board.id, (draft) => {
    draft.archived_at = archived ? now() : null
  })
}

// Optimistically drop the rows that match. collection.delete throws for an
// empty list and for rows it can't see (say, a second click while the first
// delete is still saving), so only visible rows are passed.
function deleteWhere<T extends { id: string }>(
  collection: { toArray: T[]; delete: (keys: string[]) => unknown },
  match: (row: T) => boolean,
) {
  const ids = collection.toArray.filter(match).map((row) => row.id)
  if (ids.length > 0) collection.delete(ids)
}

/**
 * Delete a board and everything on it. Postgres cascades the one delete to
 * its columns, sprints, labels and cards (and the cards' checklists and
 * activity); the same rows leave the local collections at once.
 */
export function removeBoard(board: Board) {
  return deleteBoard(board.id)
}

// Every row on a board, gone from the local collections at once.
function dropBoardLocally(boardId: string) {
  const cardIds = new Set(
    cardsCollection.toArray.filter((c) => c.board_id === boardId).map((c) => c.id),
  )
  deleteWhere(cardEventsCollection, (e) => cardIds.has(e.card_id))
  deleteWhere(checklistItemsCollection, (i) => cardIds.has(i.card_id))
  deleteWhere(cardsCollection, (c) => cardIds.has(c.id))
  deleteWhere(labelsCollection, (l) => l.board_id === boardId)
  deleteWhere(storiesCollection, (s) => s.board_id === boardId)
  deleteWhere(sprintsCollection, (s) => s.board_id === boardId)
  deleteWhere(columnsCollection, (c) => c.board_id === boardId)
  deleteWhere(boardMembersCollection, (m) => m.board_id === boardId)
  deleteWhere(boardsCollection, (b) => b.id === boardId)
}

const boardCollections = [
  boardsCollection,
  boardMembersCollection,
  columnsCollection,
  sprintsCollection,
  labelsCollection,
  storiesCollection,
  cardsCollection,
  checklistItemsCollection,
  cardEventsCollection,
]

const deleteBoard = createOptimisticAction<string>({
  onMutate: dropBoardLocally,
  mutationFn: async (boardId) => {
    await check(supabase.from('boards').delete().eq('id', boardId))
    await Promise.all(boardCollections.map((c) => c.utils.refetch()))
  },
})

// ── Sharing ──────────────────────────────────────────────────────────────

/**
 * Share a board with the DoIT account that uses `email`. Postgres checks that
 * the caller owns the board and that the account exists, and says why not.
 * Not optimistic: until it answers, there's no user to show.
 */
export async function inviteMember(board: Board, email: string) {
  await check(supabase.rpc('invite_board_member', { board: board.id, email: email.trim() }))
  await Promise.all([boardMembersCollection.utils.refetch(), profilesCollection.utils.refetch()])
}

/**
 * The owner takes someone off a board. A trigger unassigns them from its
 * cards (migration 0009); locally the cards lose them at once.
 */
export function removeMember(member: BoardMember) {
  return removeMemberAction(member)
}

const removeMemberAction = createOptimisticAction<BoardMember>({
  onMutate: (member) => {
    const cardIds = cardsCollection.toArray
      .filter((c) => c.board_id === member.board_id && c.assignee_id === member.user_id)
      .map((c) => c.id)
    if (cardIds.length > 0) {
      cardsCollection.update(cardIds, (drafts) => {
        for (const d of drafts) d.assignee_id = null
      })
    }
    deleteWhere(boardMembersCollection, (m) => m.id === member.id)
  },
  mutationFn: async (member) => {
    await check(supabase.from('board_members').delete().eq('id', member.id))
    await Promise.all(
      [boardMembersCollection, cardsCollection, profilesCollection].map((c) => c.utils.refetch()),
    )
  },
})

/** A member takes themselves off someone else's board; it leaves at once. */
export function leaveSharedBoard(board: Board) {
  return leaveBoardAction(board.id)
}

const leaveBoardAction = createOptimisticAction<string>({
  onMutate: dropBoardLocally,
  mutationFn: async (boardId) => {
    await check(
      supabase.from('board_members').delete().eq('board_id', boardId).eq('user_id', currentUserId()),
    )
    await Promise.all([...boardCollections, profilesCollection].map((c) => c.utils.refetch()))
  },
})

/**
 * Delete a label. A trigger takes it off every card in Postgres
 * (cards.label_ids has no foreign key); locally the cards lose it at once.
 */
export function removeLabel(label: Label) {
  return deleteLabel(label.id)
}

const deleteLabel = createOptimisticAction<string>({
  onMutate: (labelId) => {
    const cardIds = cardsCollection.toArray
      .filter((c) => c.label_ids.includes(labelId))
      .map((c) => c.id)
    if (cardIds.length > 0) {
      cardsCollection.update(cardIds, (drafts) => {
        for (const d of drafts) d.label_ids = d.label_ids.filter((l) => l !== labelId)
      })
    }
    deleteWhere(labelsCollection, (l) => l.id === labelId)
  },
  mutationFn: async (labelId) => {
    await check(supabase.from('labels').delete().eq('id', labelId))
    await Promise.all([cardsCollection.utils.refetch(), labelsCollection.utils.refetch()])
  },
})

export function addCard(input: {
  board: Board
  column: Column
  title: string
  sprintId: string | null
  storyId?: string | null
  position: number
  backlogPosition: number
}) {
  const card: Card = {
    id: crypto.randomUUID(),
    owner_id: currentUserId(),
    board_id: input.board.id,
    column_id: input.column.id,
    sprint_id: input.sprintId,
    story_id: input.storyId ?? null,
    assignee_id: null,
    number: 0,
    title: input.title.trim(),
    description: '',
    priority: 'medium',
    due_on: null,
    label_ids: [],
    estimate: null,
    color: null,
    position: input.position,
    backlog_position: input.backlogPosition,
    completed_at: input.column.is_done ? now() : null,
    created_by: currentUserId(),
    created_at: now(),
    updated_at: now(),
  }
  return cardsCollection.insert(card)
}

export function logEvent(cardId: string, kind: string, body: string) {
  return cardEventsCollection.insert({
    id: crypto.randomUUID(),
    owner_id: currentUserId(),
    card_id: cardId,
    kind,
    body,
    created_by: currentUserId(),
    created_at: now(),
  })
}

/**
 * Move a card on the board: new column and/or new place inside it. `change`
 * edits the card in the same write (the story board moves it between stories).
 */
export function moveCard(
  card: Card,
  from: Column,
  to: Column,
  position: number,
  change?: (draft: Card) => void,
) {
  const tx = cardsCollection.update(card.id, (draft) => {
    change?.(draft)
    draft.column_id = to.id
    draft.position = position
    if (to.is_done && !draft.completed_at) draft.completed_at = now()
    if (!to.is_done) draft.completed_at = null
  })
  // A separate write with its own toast: a failed entry isn't a failed move,
  // and the caller's toast covers the move.
  if (from.id !== to.id) {
    logEvent(card.id, 'moved', `${from.name} → ${to.name}`).isPersisted.promise.catch(
      (error: Error) =>
        toast.add({ title: 'Activity not saved', description: error.message, type: 'error' }),
    )
  }
  return tx
}

/**
 * Give a card to someone on its board (null: no one), noted in its activity
 * by their email, as it reads today.
 */
export function assignCard(card: Card, assignee: { userId: string; email: string } | null) {
  const tx = cardsCollection.update(card.id, (draft) => {
    draft.assignee_id = assignee?.userId ?? null
  })
  logEvent(card.id, 'assigned', assignee?.email ?? '').isPersisted.promise.catch((error: Error) =>
    toast.add({ title: 'Activity not saved', description: error.message, type: 'error' }),
  )
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
  mutationFn: ({ columnId, moveToId, moves }) =>
    writeThenRefetch([cardsCollection, columnsCollection], async () => {
      if (moveToId) {
        await settleAll(
          moves.map((m) =>
            check(
              supabase.from('cards').update({ column_id: moveToId, position: m.position }).eq('id', m.id),
            ),
          ),
        )
      }
      await check(supabase.from('columns').delete().eq('id', columnId))
    }),
})

// ── Sprints ──────────────────────────────────────────────────────────────

export function nextSprint(board: Board, sprints: Sprint[]): Sprint {
  const last = [...sprints].sort((a, b) => a.ends_on.localeCompare(b.ends_on)).at(-1)
  // Back to back with the latest sprint, but never starting before today: the
  // board may have been idle since its last sprint ended.
  const earliest = startOfToday()
  const start = last ? max([addDays(parseISO(last.ends_on), 1), earliest]) : earliest
  return {
    id: crypto.randomUUID(),
    owner_id: currentUserId(),
    board_id: board.id,
    name: nextSprintName(sprints.map((s) => s.name)),
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
 * to the backlog or roll into `carryTo`. The cards move first, in one
 * statement, so a failed move leaves the sprint open with all of them in it.
 */
export function closeSprint(sprint: Sprint, unfinished: Card[], carryTo: Sprint | null) {
  return closeSprintAction({
    sprintId: sprint.id,
    cardIds: unfinished.map((c) => c.id),
    carryToId: carryTo?.id ?? null,
    closedAt: now(),
  })
}

const closeSprintAction = createOptimisticAction<{
  sprintId: string
  cardIds: string[]
  carryToId: string | null
  closedAt: string
}>({
  onMutate: ({ sprintId, cardIds, carryToId, closedAt }) => {
    // update throws for an empty list or a key the collection can't see.
    const visible = cardIds.filter((id) => cardsCollection.has(id))
    if (visible.length > 0) {
      cardsCollection.update(visible, (drafts) => {
        for (const d of drafts) d.sprint_id = carryToId
      })
    }
    sprintsCollection.update(sprintId, (draft) => {
      draft.state = 'closed'
      draft.closed_at = closedAt
    })
  },
  mutationFn: ({ sprintId, cardIds, carryToId, closedAt }) =>
    writeThenRefetch([cardsCollection, sprintsCollection], async () => {
      if (cardIds.length > 0) {
        // One statement: the cards move together or not at all (say, the
        // trigger rejects a `carryTo` deleted in another tab). A card moved out
        // of this sprint in the meantime stays where it is.
        await check(
          supabase
            .from('cards')
            .update({ sprint_id: carryToId })
            .eq('sprint_id', sprintId)
            .in('id', cardIds),
        )
      }
      await check(
        supabase.from('sprints').update({ state: 'closed', closed_at: closedAt }).eq('id', sprintId),
      )
    }),
})

/**
 * Delete a sprint (planned, active or closed). Its cards stay on the board
 * without a sprint: Postgres sets cards.sprint_id to null, and so do we.
 */
export function removeSprint(sprint: Sprint) {
  return deleteSprint(sprint.id)
}

const deleteSprint = createOptimisticAction<string>({
  onMutate: (sprintId) => {
    const cardIds = cardsCollection.toArray
      .filter((c) => c.sprint_id === sprintId)
      .map((c) => c.id)
    if (cardIds.length > 0) {
      cardsCollection.update(cardIds, (drafts) => {
        for (const d of drafts) d.sprint_id = null
      })
    }
    deleteWhere(sprintsCollection, (s) => s.id === sprintId)
  },
  mutationFn: async (sprintId) => {
    await check(supabase.from('sprints').delete().eq('id', sprintId))
    await Promise.all([cardsCollection.utils.refetch(), sprintsCollection.utils.refetch()])
  },
})

// ── Stories ──────────────────────────────────────────────────────────────

/**
 * Delete a story. Its cards stay on the board in no story: Postgres sets
 * cards.story_id to null, and so do we.
 */
export function removeStory(story: Story) {
  return deleteStory(story.id)
}

const deleteStory = createOptimisticAction<string>({
  onMutate: (storyId) => {
    const cardIds = cardsCollection.toArray
      .filter((c) => c.story_id === storyId)
      .map((c) => c.id)
    if (cardIds.length > 0) {
      cardsCollection.update(cardIds, (drafts) => {
        for (const d of drafts) d.story_id = null
      })
    }
    deleteWhere(storiesCollection, (s) => s.id === storyId)
  },
  mutationFn: async (storyId) => {
    await check(supabase.from('stories').delete().eq('id', storyId))
    await Promise.all([cardsCollection.utils.refetch(), storiesCollection.utils.refetch()])
  },
})

// ── Todos ────────────────────────────────────────────────────────────────

/**
 * Copy cards into the todo list, on top of the inbox or of `sectionId`, in
 * the order given. Each todo reads "KEY-12 Title", keeps the card's due date
 * and links back to the card. One insert, so they save or fail together.
 */
export function importCardsAsTodos(
  cards: ReadonlyArray<{ card: Card; key: string }>,
  sectionId: string | null,
) {
  const first = todosCollection.toArray
    .filter((t) => t.section_id === sectionId)
    .reduce((min, t) => Math.min(min, t.position), Infinity)
  const step = 1024
  const start = Number.isFinite(first) ? first - step * cards.length : step
  const todos: Todo[] = cards.map(({ card, key }, i) => ({
    id: crypto.randomUUID(),
    owner_id: currentUserId(),
    section_id: sectionId,
    card_id: card.id,
    text: `${key} ${card.title}`,
    done: false,
    due_on: card.due_on,
    position: start + step * i,
    created_at: now(),
  }))
  return todosCollection.insert(todos)
}

/**
 * Delete a todo section. Its todos move to the end of the inbox first, so
 * none are lost and they keep their order.
 */
export function removeTodoSection(section: TodoSection) {
  const inbox = todosCollection.toArray
    .filter((t) => t.section_id === null)
    .map((t) => t.position)
    .sort((a, b) => a - b)
  let position = positionAfterLast(inbox)
  const moves = todosCollection.toArray
    .filter((t) => t.section_id === section.id)
    .sort((a, b) => a.position - b.position)
    .map((t) => {
      const move = { id: t.id, position }
      position += 1024
      return move
    })
  return deleteTodoSection({ sectionId: section.id, moves })
}

const deleteTodoSection = createOptimisticAction<{
  sectionId: string
  moves: Array<{ id: string; position: number }>
}>({
  onMutate: ({ sectionId, moves }) => {
    const byId = new Map(
      moves.filter((m) => todosCollection.has(m.id)).map((m) => [m.id, m.position]),
    )
    if (byId.size > 0) {
      todosCollection.update([...byId.keys()], (drafts) => {
        for (const d of drafts) {
          d.section_id = null
          d.position = byId.get(d.id)!
        }
      })
    }
    deleteWhere(todoSectionsCollection, (s) => s.id === sectionId)
  },
  mutationFn: ({ sectionId, moves }) =>
    writeThenRefetch([todosCollection, todoSectionsCollection], async () => {
      await settleAll(
        moves.map((m) =>
          check(
            supabase.from('todos').update({ section_id: null, position: m.position }).eq('id', m.id),
          ),
        ),
      )
      await check(supabase.from('todo_sections').delete().eq('id', sectionId))
    }),
})
