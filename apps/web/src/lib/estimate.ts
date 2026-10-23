// Estimates are days of work on a card, halves and quarters allowed.

/**
 * Parse what was typed as an estimate in days: blank clears it, a comma works
 * as the decimal point, and anything negative, over 999 or not a number is
 * rejected (undefined). Kept to two decimals.
 */
export function parseEstimate(text: string): number | null | undefined {
  const trimmed = text.trim().replace(',', '.')
  if (trimmed === '') return null
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < 0 || value > 999) return undefined
  return Math.round(value * 100) / 100
}
