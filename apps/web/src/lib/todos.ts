import type { Todo } from '@/data/schemas'
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
