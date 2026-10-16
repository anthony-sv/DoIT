import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { Priority } from '@/data/schemas'

/** "DSC-14"; a card that is still saving has no number yet. */
export function cardKey(boardKey: string, number: number) {
  return number > 0 ? `${boardKey}-${number}` : `${boardKey}-…`
}

export type DueState = 'overdue' | 'soon' | 'later'

export function dueInfo(dueOn: string, done: boolean, today = new Date()) {
  const date = parseISO(dueOn)
  const days = differenceInCalendarDays(date, today)
  const short = format(date, 'MMM d')
  if (done) return { state: 'later' as DueState, label: short }
  if (days < 0) return { state: 'overdue' as DueState, label: `Overdue · ${short}` }
  if (days === 0) return { state: 'soon' as DueState, label: 'Today' }
  if (days === 1) return { state: 'soon' as DueState, label: 'Tomorrow' }
  return { state: 'later' as DueState, label: short }
}

export function sprintRange(startsOn: string, endsOn: string) {
  const start = parseISO(startsOn)
  const end = parseISO(endsOn)
  const sameMonth = start.getMonth() === end.getMonth()
  return `${format(start, 'MMM d')} – ${format(end, sameMonth ? 'd' : 'MMM d')}`
}

export const priorityNames: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

/** Whole days from now until the end of `endsOn` (negative once it is past). */
export function daysUntil(endsOn: string, now = new Date()) {
  return Math.ceil((new Date(`${endsOn}T23:59:59`).getTime() - now.getTime()) / 86_400_000)
}
