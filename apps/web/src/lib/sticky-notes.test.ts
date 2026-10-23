import { describe, expect, it } from 'vitest'
import { largestAtDays, noteSize, noteTitleLines, smallestNote } from './sticky-notes'

const area = ({ width, height }: { width: number; height: number }) => width * height

describe('noteSize', () => {
  it('gives no estimate and 0 days the smallest note', () => {
    expect(noteSize(null)).toEqual(smallestNote)
    expect(noteSize(0)).toEqual(smallestNote)
    expect(smallestNote).toEqual({ width: 128, height: 88 })
  })

  it('treats nonsense like no estimate', () => {
    expect(noteSize(-2)).toEqual(smallestNote)
    expect(noteSize(Number.NaN)).toEqual(smallestNote)
  })

  it('caps the size from the largest estimate up', () => {
    const largest = noteSize(largestAtDays)
    expect(largest).toEqual({ width: 200, height: 138 })
    expect(noteSize(12)).toEqual(largest)
    expect(noteSize(999)).toEqual(largest)
    expect(noteSize(Number.POSITIVE_INFINITY)).toEqual(largest)
  })

  it('never shrinks as the estimate grows', () => {
    let previous = noteSize(0)
    for (let days = 0.25; days <= 10; days += 0.25) {
      const size = noteSize(days)
      expect(size.width).toBeGreaterThanOrEqual(previous.width)
      expect(size.height).toBeGreaterThanOrEqual(previous.height)
      previous = size
    }
  })

  it('makes a day visibly bigger than nothing, and 4 days far bigger than 1', () => {
    const none = area(noteSize(null))
    const one = area(noteSize(1))
    const four = area(noteSize(4))
    expect(one / none).toBeGreaterThan(1.25)
    expect(four / one).toBeGreaterThan(1.6)
    expect(four / one).toBeLessThan(2.2)
  })

  it('grows the area in a straight line with the days', () => {
    const none = area(noteSize(0))
    const largest = area(noteSize(largestAtDays))
    for (const days of [0.5, 1, 2, 3, 4]) {
      const expected = none + ((largest - none) * days) / largestAtDays
      // Rounding the sides to whole px moves the area a little.
      expect(Math.abs(area(noteSize(days)) / expected - 1)).toBeLessThan(0.01)
    }
  })

  it('keeps the sticky-note shape', () => {
    for (const days of [null, 0.5, 1, 4, 8]) {
      const { width, height } = noteSize(days)
      expect(width / height).toBeCloseTo(128 / 88, 1)
    }
  })
})

describe('noteTitleLines', () => {
  it('fits two lines on the smallest note and five on the largest', () => {
    expect(noteTitleLines(noteSize(null).height)).toBe(2)
    expect(noteTitleLines(noteSize(largestAtDays).height)).toBe(5)
  })

  it('leaves room for the border, padding, key row and footer', () => {
    // 2 x (1 + 8) + 16 + 20 = 54px of chrome, then 16px a line.
    expect(noteTitleLines(85)).toBe(1)
    expect(noteTitleLines(86)).toBe(2)
    expect(noteTitleLines(101)).toBe(2)
    expect(noteTitleLines(102)).toBe(3)
  })

  it('always shows at least a line', () => {
    expect(noteTitleLines(40)).toBe(1)
  })

  it('gives bigger notes more lines', () => {
    expect(noteTitleLines(noteSize(4).height)).toBeGreaterThan(noteTitleLines(noteSize(1).height))
  })
})
