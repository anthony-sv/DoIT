import { describe, expect, it } from 'vitest'
import type { Card, Sprint } from '@/data/schemas'
import { burndownRows } from './burndown'

const sprint = {
  starts_on: '2026-10-13',
  ends_on: '2026-10-17',
} as Sprint

const card = (completed_at: string | null) => ({ completed_at }) as Card

describe('burndownRows', () => {
  const cards = [
    card(null),
    card('2026-10-14T15:00:00'),
    card('2026-10-15T09:00:00'),
    card(null),
  ]
  const rows = burndownRows(sprint, cards, new Date(2026, 9, 15, 12))

  it('has one row per sprint day', () => {
    expect(rows.map((r) => r.day)).toEqual(['Oct 13', 'Oct 14', 'Oct 15', 'Oct 16', 'Oct 17'])
  })

  it('counts cards still open at the end of each day, up to today', () => {
    expect(rows.map((r) => r.remaining)).toEqual([4, 3, 2, null, null])
  })

  it('draws the ideal line from everything to nothing', () => {
    expect(rows[0]!.ideal).toBe(4)
    expect(rows.at(-1)!.ideal).toBe(0)
  })
})
