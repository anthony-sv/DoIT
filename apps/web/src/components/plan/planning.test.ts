import { describe, expect, it } from 'vitest'
import type { Card } from '@/data/schemas'
import { BACKLOG, cardsLabel, planningLists } from './planning'

const card = (id: string, sprint_id: string | null, done = false) =>
  ({ id, sprint_id, column_id: done ? 'done' : 'todo' }) as Card
const isDone = (c: Card) => c.column_id === 'done'

describe('planningLists', () => {
  const cards = [
    card('a', null),
    card('b', null, true),
    card('c', 'active'),
    card('d', 'active', true),
    card('e', 'planned'),
    card('f', 'closed'),
    card('g', null),
  ]
  const lists = planningLists(cards, ['active', 'planned'], isDone)

  it('keeps unfinished cards without a sprint in the backlog, in order', () => {
    expect(lists[BACKLOG]).toEqual(['a', 'g'])
  })

  it('lists every card of an open sprint, finished ones too', () => {
    expect(lists.active).toEqual(['c', 'd'])
    expect(lists.planned).toEqual(['e'])
  })

  it('leaves out cards of other sprints', () => {
    expect(Object.values(lists).flat()).not.toContain('f')
  })

  it('has a list for a sprint with no cards yet', () => {
    expect(planningLists([], ['new'], isDone)).toEqual({ [BACKLOG]: [], new: [] })
  })
})

describe('cardsLabel', () => {
  it('counts one card and many', () => {
    expect(cardsLabel(1)).toBe('1 card')
    expect(cardsLabel(0)).toBe('0 cards')
    expect(cardsLabel(12)).toBe('12 cards')
  })
})
