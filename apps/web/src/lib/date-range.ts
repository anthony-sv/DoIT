import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'

/** Both ends included, as 'yyyy-MM-dd'. */
export interface DayRange {
  from: string
  to: string
}

export const toDay = (date: Date) => format(date, 'yyyy-MM-dd')

export function lengthInDays({ from, to }: DayRange) {
  return differenceInCalendarDays(parseISO(to), parseISO(from)) + 1
}

/** "1 day", "10 days", or "2 weeks" when the length is whole weeks. */
export function rangeLength(range: DayRange) {
  const days = lengthInDays(range)
  if (days % 7 === 0) return days === 7 ? '1 week' : `${days / 7} weeks`
  return days === 1 ? '1 day' : `${days} days`
}

/** `weeks` whole weeks starting on `from`. */
export function weeksFrom(from: string, weeks: number): DayRange {
  return { from, to: toDay(addDays(parseISO(from), weeks * 7 - 1)) }
}
