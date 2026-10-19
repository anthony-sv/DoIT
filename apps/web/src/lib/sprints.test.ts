import { describe, expect, it } from 'vitest'
import { nextSprintName } from './sprints'

describe('nextSprintName', () => {
  it('starts at Sprint 1', () => {
    expect(nextSprintName([])).toBe('Sprint 1')
  })

  it('follows the highest number', () => {
    expect(nextSprintName(['Sprint 1', 'Sprint 2'])).toBe('Sprint 3')
  })

  it('skips numbers freed by a deleted sprint', () => {
    expect(nextSprintName(['Sprint 2', 'Sprint 3'])).toBe('Sprint 4')
  })

  it('counts renamed sprints', () => {
    expect(nextSprintName(['Launch', 'Polish'])).toBe('Sprint 3')
  })
})
