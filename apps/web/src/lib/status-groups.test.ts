import { describe, expect, it } from 'vitest'
import { groupByColumn, totalEstimate } from './status-groups'

describe('groupByColumn', () => {
  const columns = [{ id: 'todo' }, { id: 'doing' }, { id: 'done' }]

  it('follows the column order and keeps the cards in theirs', () => {
    const cards = [
      { id: 'a', column_id: 'done' },
      { id: 'b', column_id: 'todo' },
      { id: 'c', column_id: 'done' },
    ]
    expect(groupByColumn(columns, cards)).toEqual([
      { column: { id: 'todo' }, cards: [{ id: 'b', column_id: 'todo' }] },
      { column: { id: 'doing' }, cards: [] },
      {
        column: { id: 'done' },
        cards: [
          { id: 'a', column_id: 'done' },
          { id: 'c', column_id: 'done' },
        ],
      },
    ])
  })

  it('leaves out cards whose column is not listed', () => {
    const groups = groupByColumn(columns, [{ id: 'x', column_id: 'gone' }])
    expect(groups.flatMap((g) => g.cards)).toEqual([])
  })

  it('has no groups without columns', () => {
    expect(groupByColumn([], [{ id: 'x', column_id: 'todo' }])).toEqual([])
  })
})

describe('totalEstimate', () => {
  it('adds up the cards that have one', () => {
    expect(totalEstimate([{ estimate: 1.5 }, { estimate: null }, { estimate: 3 }])).toBe(4.5)
  })

  it('counts a zero estimate as an estimate', () => {
    expect(totalEstimate([{ estimate: 0 }, { estimate: null }])).toBe(0)
  })

  it('is null when no card has one', () => {
    expect(totalEstimate([])).toBeNull()
    expect(totalEstimate([{ estimate: null }])).toBeNull()
  })

  it('drops float noise', () => {
    expect(totalEstimate([{ estimate: 0.1 }, { estimate: 0.2 }])).toBe(0.3)
  })
})
