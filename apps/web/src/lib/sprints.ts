/**
 * "Sprint 4" after "Sprint 3", even when earlier sprints were deleted or
 * renamed: one past the highest number in use, or the count if that's higher.
 */
export function nextSprintName(names: readonly string[]): string {
  const numbers = names.map((name) => Number(/^Sprint (\d+)$/.exec(name)?.[1] ?? 0))
  return `Sprint ${Math.max(names.length, ...numbers) + 1}`
}
