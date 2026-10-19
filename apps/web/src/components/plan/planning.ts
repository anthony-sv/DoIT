import type { Card } from '@/data/schemas'

/** List id for cards in no sprint; a sprint's list uses the sprint id. */
export const BACKLOG = 'backlog'

export type Lists = Record<string, string[]>

/**
 * Card ids per planning list, in the order of `cards`. The backlog holds the
 * unfinished cards in no sprint; each of `sprintIds` holds all of its cards,
 * finished ones too. Cards of other (closed) sprints are in no list.
 */
export function planningLists(
  cards: readonly Card[],
  sprintIds: readonly string[],
  isDone: (card: Card) => boolean,
): Lists {
  const lists: Lists = { [BACKLOG]: [] }
  for (const id of sprintIds) lists[id] = []
  for (const card of cards) {
    if (card.sprint_id === null) {
      if (!isDone(card)) lists[BACKLOG]!.push(card.id)
    } else {
      lists[card.sprint_id]?.push(card.id)
    }
  }
  return lists
}

export function cardsLabel(count: number) {
  return count === 1 ? '1 card' : `${count} cards`
}
