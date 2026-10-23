// On the story board each task is a sticky note whose size shows its
// estimate. The note's area grows in a straight line with the days (so its
// sides grow with their square root): 0.5 d is 137 x 94, 1 d 145 x 100,
// 4 d 188 x 129, and from 5 d up every note is the largest, 200 x 138. That
// keeps a column narrow enough for a four-column board to fit beside the
// sidebar on a 1440px screen.

export interface NoteSize {
  width: number
  height: number
}

/** No estimate, or 0 days. */
export const smallestNote: NoteSize = { width: 128, height: 88 }

/** Estimates from this many days up all get the largest note. */
export const largestAtDays = 5

// The largest note's sides, as a multiple of the smallest one's (200 x 138).
const largestScale = 200 / 128

/** The note's size in px for an estimate in days. */
export function noteSize(estimate: number | null): NoteSize {
  const days =
    estimate === null || Number.isNaN(estimate)
      ? 0
      : Math.min(Math.max(estimate, 0), largestAtDays)
  const area = 1 + (largestScale ** 2 - 1) * (days / largestAtDays)
  const scale = Math.sqrt(area)
  return {
    width: Math.round(smallestNote.width * scale),
    height: Math.round(smallestNote.height * scale),
  }
}

// What a note spends on everything but its title (story-note.tsx; its fixed
// height includes the border): a 1px border and 8px of padding top and
// bottom, the 16px key row and the 20px footer. The title gets the rest at
// 16px a line, so the smallest note (88) still fits two.
const noteChrome = 2 * (1 + 8) + 16 + 20
const titleLine = 16

/** How many lines of title fit on a note this tall; at least one. */
export function noteTitleLines(height: number): number {
  return Math.max(1, Math.floor((height - noteChrome) / titleLine))
}
