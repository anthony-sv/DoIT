import { describe, expect, it } from 'vitest'
import { rangeLength, weeksFrom } from './date-range'

describe('rangeLength', () => {
  it('counts both ends', () => {
    expect(rangeLength({ from: '2026-10-16', to: '2026-10-16' })).toBe('1 day')
    expect(rangeLength({ from: '2026-10-16', to: '2026-10-25' })).toBe('10 days')
  })

  it('says weeks when the length is whole weeks', () => {
    expect(rangeLength({ from: '2026-10-16', to: '2026-10-22' })).toBe('1 week')
    expect(rangeLength({ from: '2026-10-16', to: '2026-10-29' })).toBe('2 weeks')
  })

  it('ignores a daylight saving change inside the range', () => {
    expect(rangeLength({ from: '2026-10-19', to: '2026-11-01' })).toBe('2 weeks')
    expect(rangeLength({ from: '2027-03-22', to: '2027-04-04' })).toBe('2 weeks')
  })
})

describe('weeksFrom', () => {
  it('keeps the start and ends the day before the next week would begin', () => {
    expect(weeksFrom('2026-10-16', 1)).toEqual({ from: '2026-10-16', to: '2026-10-22' })
    expect(weeksFrom('2026-10-16', 2)).toEqual({ from: '2026-10-16', to: '2026-10-29' })
  })

  it('crosses months and years', () => {
    expect(weeksFrom('2026-12-28', 1)).toEqual({ from: '2026-12-28', to: '2027-01-03' })
  })

  it('agrees with rangeLength', () => {
    for (const weeks of [1, 2, 3, 4]) {
      expect(rangeLength(weeksFrom('2026-10-26', weeks))).toBe(weeks === 1 ? '1 week' : `${weeks} weeks`)
    }
  })
})
