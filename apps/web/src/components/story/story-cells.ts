// How the story board lays out cards: a lane per story plus one for cards in
// no story, and a cell where each lane crosses a board column.
import type { Card, Column, Story } from '@/data/schemas'
import { positionBetween } from '@/lib/position'

/** The lane of cards in no story, or in a story that is gone. */
export const NO_STORY = 'none'

/** Card ids per cell id. */
export type Cells = Record<string, string[]>

// Story and column ids are UUIDs, so ':' can't appear in either.
export function cellId(lane: string, columnId: string) {
  return `${lane}:${columnId}`
}

export function parseCellId(id: string): { lane: string; columnId: string } | null {
  const at = id.indexOf(':')
  if (at < 0) return null
  return { lane: id.slice(0, at), columnId: id.slice(at + 1) }
}

/** The story id a lane writes to a card: null for NO_STORY. */
export function laneStoryId(lane: string): string | null {
  return lane === NO_STORY ? null : lane
}

/** A card's lane: its story when that story is on the board, else NO_STORY. */
export function laneOf(card: Pick<Card, 'story_id'>, storyIds: ReadonlySet<string>) {
  return card.story_id !== null && storyIds.has(card.story_id) ? card.story_id : NO_STORY
}

/**
 * Card ids per cell, in the order of `cards`. Every lane (each story, then
 * NO_STORY) has a cell in every column, empty or not; cards in a column that
 * isn't listed are left out.
 */
export function storyCells(
  stories: readonly Pick<Story, 'id'>[],
  columns: readonly Pick<Column, 'id'>[],
  cards: readonly Pick<Card, 'id' | 'story_id' | 'column_id'>[],
): Cells {
  const cells: Cells = {}
  for (const lane of [...stories.map((s) => s.id), NO_STORY]) {
    for (const column of columns) cells[cellId(lane, column.id)] = []
  }
  const storyIds = new Set(stories.map((s) => s.id))
  for (const card of cards) cells[cellId(laneOf(card, storyIds), card.column_id)]?.push(card.id)
  return cells
}

export interface LaneStats {
  /** Days estimated; cards without an estimate count as nothing. */
  days: number
  done: number
  total: number
}

/** Totals for the cards of one lane; done means in a done column. */
export function laneStats(
  cards: readonly Pick<Card, 'column_id' | 'estimate'>[],
  doneColumnIds: ReadonlySet<string>,
): LaneStats {
  let days = 0
  let done = 0
  for (const card of cards) {
    days += card.estimate ?? 0
    if (doneColumnIds.has(card.column_id)) done += 1
  }
  return { days, done, total: cards.length }
}

/**
 * Position for a card dropped between `before` and `after`, its neighbours in
 * a cell (either may be missing), when the column's other cards sit at
 * `column` (sorted). A cell is one lane's share of a column, and other lanes'
 * cards sit between its neighbours, so the card goes right after `before` in
 * the whole column (or right before `after` when it leads the cell): halving
 * the gap between the neighbours, or a fixed step, could land exactly on
 * another lane's card. In an empty cell it goes to the end of the column.
 */
export function positionInCell(
  column: readonly number[],
  before: number | undefined,
  after: number | undefined,
): number {
  if (before !== undefined) return positionBetween(before, column.find((p) => p > before) ?? after)
  if (after !== undefined) return positionBetween(column.findLast((p) => p < after), after)
  return positionBetween(column.at(-1), undefined)
}
