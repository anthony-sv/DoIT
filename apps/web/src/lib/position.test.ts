import { describe, expect, it } from 'vitest'
import { placeAt, positionAt, positionBetween, withItemAt } from './position'

describe('positionBetween', () => {
  it('starts an empty list', () => {
    expect(positionBetween()).toBe(1024)
  })

  it('goes before the first and after the last', () => {
    expect(positionBetween(undefined, 1024)).toBe(0)
    expect(positionBetween(1024, undefined)).toBe(2048)
  })

  it('splits the gap between neighbours', () => {
    expect(positionBetween(1024, 2048)).toBe(1536)
  })
})

describe('positionAt', () => {
  const siblings = [1024, 2048, 3072]

  it('keeps the order for every drop index', () => {
    for (let index = 0; index <= siblings.length; index++) {
      const p = positionAt(siblings, index)
      if (index > 0) expect(p).toBeGreaterThan(siblings[index - 1]!)
      if (index < siblings.length) expect(p).toBeLessThan(siblings[index]!)
    }
  })
})

describe('placeAt', () => {
  it('moves an item within its list', () => {
    expect(placeAt(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a'])
  })

  it('adds an item from another list', () => {
    expect(placeAt(['a', 'b'], 'x', 1)).toEqual(['a', 'x', 'b'])
  })

  it('clamps an index past the end', () => {
    expect(placeAt(['a'], 'x', 9)).toEqual(['a', 'x'])
  })
})

describe('withItemAt', () => {
  it('takes the item out of its old list', () => {
    expect(withItemAt({ todo: ['a', 'b'], done: [] }, 'done', 'a', 0)).toEqual({
      todo: ['b'],
      done: ['a'],
    })
  })
})
