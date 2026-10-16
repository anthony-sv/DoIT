// Fractional ordering: an item's position sits between its neighbours, so a
// move writes one row instead of renumbering the whole list.
const STEP = 1024

export function positionBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return STEP
  if (before === undefined) return after! - STEP
  if (after === undefined) return before + STEP
  return (before + after) / 2
}

/** Position for an item dropped at `index` of `siblings` (already sorted, item excluded). */
export function positionAt(siblings: readonly number[], index: number): number {
  return positionBetween(siblings[index - 1], siblings[index])
}

export function positionAfterLast(siblings: readonly number[]): number {
  return positionBetween(siblings.at(-1), undefined)
}

/** `list` with `id` moved (or added) to `index`, clamped to the list. */
export function placeAt(list: readonly string[], id: string, index: number): string[] {
  const rest = list.filter((x) => x !== id)
  rest.splice(Math.max(0, Math.min(index, rest.length)), 0, id)
  return rest
}

/** Every list without `id`, except `listId`, which gets it at `index`. */
export function withItemAt(
  lists: Readonly<Record<string, readonly string[]>>,
  listId: string,
  id: string,
  index: number,
): Record<string, string[]> {
  const next: Record<string, string[]> = {}
  for (const [key, list] of Object.entries(lists)) {
    next[key] = key === listId ? placeAt(list, id, index) : list.filter((x) => x !== id)
  }
  return next
}
