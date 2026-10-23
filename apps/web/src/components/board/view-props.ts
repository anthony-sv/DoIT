import type { Board, Card, Column, Label, Story } from '@/data/schemas'

/** Checklist items done and in total, by card id. */
export type ChecklistProgress = Map<string, { done: number; total: number }>

/** The board page's views: columns, a table grouped by status, and stories. */
export const boardViews = ['board', 'table', 'stories'] as const
export type BoardViewName = (typeof boardViews)[number]

/** What every view of a board is drawn from; the board page loads it once. */
export interface BoardViewProps {
  board: Board
  /** In board order. */
  columns: Column[]
  /** What the header's sprint and text filters let through, by `position`. */
  cards: Card[]
  labels: Label[]
  /** In story order (`position`). */
  stories: Story[]
  progress: ChecklistProgress
  /** The sprint new cards join: the one shown, unless it's closed. */
  sprintId: string | null
  onOpenCard: (id: string) => void
}
