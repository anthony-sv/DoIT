import { describe, expect, it } from 'vitest'
import { parseEstimate } from './estimate'

describe('parseEstimate', () => {
  it('reads days, with a comma or a point', () => {
    expect(parseEstimate('2')).toBe(2)
    expect(parseEstimate(' 0,5 ')).toBe(0.5)
    expect(parseEstimate('1.234')).toBe(1.23)
  })

  it('clears on blank and rejects the rest', () => {
    expect(parseEstimate('')).toBeNull()
    expect(parseEstimate('-1')).toBeUndefined()
    expect(parseEstimate('1000')).toBeUndefined()
    expect(parseEstimate('two')).toBeUndefined()
  })
})
