// The table view's groups: one per board column (its status), in board order.

/**
 * Every column with its cards, in column order. Cards keep the order they
 * came in (by position) and a column without cards still gets a group;
 * cards in a column that isn't listed are left out.
 */
export function groupByColumn<C extends { id: string }, T extends { column_id: string }>(
  columns: readonly C[],
  cards: readonly T[],
): Array<{ column: C; cards: T[] }> {
  const byColumn = new Map(columns.map((c) => [c.id, [] as T[]]))
  for (const card of cards) byColumn.get(card.column_id)?.push(card)
  return columns.map((column) => ({ column, cards: byColumn.get(column.id)! }))
}

/** Days estimated across `cards`; null when none of them has an estimate. */
export function totalEstimate(cards: readonly { estimate: number | null }[]): number | null {
  let total: number | null = null
  for (const { estimate } of cards) {
    if (estimate !== null) total = (total ?? 0) + estimate
  }
  // Estimates have two decimals; this drops the float noise of adding them.
  return total === null ? null : Math.round(total * 100) / 100
}
