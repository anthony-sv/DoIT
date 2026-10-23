import { describe, expect, it } from 'vitest'
import type { Card } from '@/data/schemas'
import {
  NO_STORY,
  cellId,
  laneOf,
  laneStats,
  laneStoryId,
  parseCellId,
  positionInCell,
  storyCells,
} from './story-cells'

const card = (id: string, story_id: string | null, column_id: string, estimate: number | null = null) =>
  ({ id, story_id, column_id, estimate }) as Card

describe('cell ids', () => {
  it('round-trips a lane and a column', () => {
    const id = cellId('story-1', 'column-1')
    expect(parseCellId(id)).toEqual({ lane: 'story-1', columnId: 'column-1' })
    expect(parseCellId(cellId(NO_STORY, 'c'))).toEqual({ lane: NO_STORY, columnId: 'c' })
  })

  it('rejects anything else', () => {
    expect(parseCellId('column-1')).toBeNull()
  })

  it('writes no story for the no-story lane', () => {
    expect(laneStoryId(NO_STORY)).toBeNull()
    expect(laneStoryId('s1')).toBe('s1')
  })
})

describe('laneOf', () => {
  const storyIds = new Set(['s1'])

  it('puts a card in its story', () => {
    expect(laneOf(card('a', 's1', 'c'), storyIds)).toBe('s1')
  })

  it('puts a card without a story, or with one that is gone, in no story', () => {
    expect(laneOf(card('a', null, 'c'), storyIds)).toBe(NO_STORY)
    expect(laneOf(card('a', 'gone', 'c'), storyIds)).toBe(NO_STORY)
  })
})

describe('storyCells', () => {
  const stories = [{ id: 's1' }, { id: 's2' }]
  const columns = [{ id: 'todo' }, { id: 'done' }]

  it('has a cell for every lane in every column', () => {
    const cells = storyCells(stories, columns, [])
    expect(Object.keys(cells).sort()).toEqual(
      [
        cellId('s1', 'todo'),
        cellId('s1', 'done'),
        cellId('s2', 'todo'),
        cellId('s2', 'done'),
        cellId(NO_STORY, 'todo'),
        cellId(NO_STORY, 'done'),
      ].sort(),
    )
    expect(Object.values(cells).every((ids) => ids.length === 0)).toBe(true)
  })

  it('files cards by story and column, keeping their order', () => {
    const cells = storyCells(stories, columns, [
      card('a', 's1', 'todo'),
      card('b', null, 'todo'),
      card('c', 's1', 'todo'),
      card('d', 's2', 'done'),
      card('e', 'gone', 'done'),
    ])
    expect(cells[cellId('s1', 'todo')]).toEqual(['a', 'c'])
    expect(cells[cellId('s2', 'done')]).toEqual(['d'])
    expect(cells[cellId(NO_STORY, 'todo')]).toEqual(['b'])
    expect(cells[cellId(NO_STORY, 'done')]).toEqual(['e'])
  })

  it('leaves out cards in a column it was not given', () => {
    const cells = storyCells(stories, columns, [card('a', 's1', 'elsewhere')])
    expect(Object.values(cells).flat()).toEqual([])
  })
})

describe('laneStats', () => {
  it('adds up estimates and counts cards in done columns', () => {
    const stats = laneStats(
      [card('a', 's', 'todo', 0.5), card('b', 's', 'done', 2), card('c', 's', 'todo')],
      new Set(['done']),
    )
    expect(stats).toEqual({ days: 2.5, done: 1, total: 3 })
  })

  it('is all zeros for no cards', () => {
    expect(laneStats([], new Set())).toEqual({ days: 0, done: 0, total: 0 })
  })
})

describe('positionInCell', () => {
  // The column's cards across all lanes; the cell holds 2048 and 4096.
  const column = [1024, 2048, 3072, 4096, 5120]

  it('lands between both neighbours without taking a position from another lane', () => {
    // 3072, halfway between the neighbours, belongs to another lane's card.
    const p = positionInCell(column, 2048, 4096)
    expect(p).toBeGreaterThan(2048)
    expect(p).toBeLessThan(3072)
    expect(column).not.toContain(p)
  })

  it('splits the gap when no other lane sits between the neighbours', () => {
    expect(positionInCell([1024, 2048, 4096], 2048, 4096)).toBe(3072)
  })

  it('never takes a position the column already has', () => {
    const drops: [number | undefined, number | undefined][] = [
      [undefined, undefined],
      [undefined, 1024],
      [undefined, 4096],
      [1024, 5120],
      [2048, 3072],
      [3072, undefined],
    ]
    for (const [before, after] of drops) {
      expect(column).not.toContain(positionInCell(column, before, after))
    }
  })

  it('stays before the next card of the column after the last neighbour', () => {
    const p = positionInCell(column, 4096, undefined)
    expect(p).toBeGreaterThan(4096)
    expect(p).toBeLessThan(5120)
  })

  it('stays after the previous card of the column before the first neighbour', () => {
    const p = positionInCell(column, undefined, 2048)
    expect(p).toBeGreaterThan(1024)
    expect(p).toBeLessThan(2048)
  })

  it('steps past the ends of the column', () => {
    expect(positionInCell(column, 5120, undefined)).toBe(6144)
    expect(positionInCell(column, undefined, 1024)).toBe(0)
  })

  it('puts a card in an empty cell at the end of the column', () => {
    expect(positionInCell(column, undefined, undefined)).toBe(6144)
    expect(positionInCell([], undefined, undefined)).toBe(1024)
  })
})
