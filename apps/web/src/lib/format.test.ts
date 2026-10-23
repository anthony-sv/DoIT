import { describe, expect, it } from 'vitest'
import { cardKey, daysLabel, dueInfo, sprintRange } from './format'

describe('cardKey', () => {
  it('shows a placeholder until the number arrives', () => {
    expect(cardKey('DSC', 14)).toBe('DSC-14')
    expect(cardKey('DSC', 0)).toBe('DSC-…')
  })
})

describe('dueInfo', () => {
  const today = new Date(2026, 9, 16)

  it('flags overdue, today and tomorrow', () => {
    expect(dueInfo('2026-10-14', false, today)).toEqual({ state: 'overdue', label: 'Overdue · Oct 14' })
    expect(dueInfo('2026-10-16', false, today).label).toBe('Today')
    expect(dueInfo('2026-10-17', false, today).label).toBe('Tomorrow')
    expect(dueInfo('2026-10-22', false, today)).toEqual({ state: 'later', label: 'Oct 22' })
  })

  it('never nags about finished cards', () => {
    expect(dueInfo('2026-10-01', true, today).state).toBe('later')
  })
})

describe('sprintRange', () => {
  it('drops the repeated month', () => {
    expect(sprintRange('2026-10-13', '2026-10-24')).toBe('Oct 13 – 24')
    expect(sprintRange('2026-10-27', '2026-11-07')).toBe('Oct 27 – Nov 7')
  })
})

describe('daysLabel', () => {
  it('writes halves and drops float noise', () => {
    expect(daysLabel(0.5)).toBe('0.5 d')
    expect(daysLabel(0.1 + 0.2)).toBe('0.3 d')
    expect(daysLabel(3)).toBe('3 d')
  })

  it('spells out totals', () => {
    expect(daysLabel(1, 'long')).toBe('1 day')
    expect(daysLabel(10.5, 'long')).toBe('10.5 days')
    expect(daysLabel(0, 'long')).toBe('0 days')
  })
})
