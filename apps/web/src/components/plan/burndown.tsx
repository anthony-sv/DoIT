import { useMemo } from 'react'
import { defineChart, lineY } from '@tanstack/charts'
import { crosshair } from '@tanstack/charts/crosshair'
import { Chart } from '@tanstack/charts/react'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'
import { tooltip } from '@tanstack/charts/tooltip'
import { addDays, differenceInCalendarDays, endOfDay, format, parseISO } from 'date-fns'
import type { Card, Sprint } from '@/data/schemas'

export interface BurndownRow {
  day: string
  remaining: number | null
  ideal: number
}

/**
 * One row per sprint day: cards still open at the end of that day (only up to
 * today) and the straight line from "everything open" to "nothing open".
 */
export function burndownRows(sprint: Sprint, cards: Card[], now = new Date()): BurndownRow[] {
  const start = parseISO(sprint.starts_on)
  const days = differenceInCalendarDays(parseISO(sprint.ends_on), start) + 1
  const total = cards.length
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i)
    const cutoff = endOfDay(date).getTime()
    const remaining =
      date.getTime() > now.getTime()
        ? null
        : cards.filter((c) => !c.completed_at || parseISO(c.completed_at).getTime() > cutoff)
            .length
    return {
      day: format(date, 'MMM d'),
      remaining,
      ideal: days === 1 ? 0 : total * (1 - i / (days - 1)),
    }
  })
}

export function Burndown({ sprint, cards }: { sprint: Sprint; cards: Card[] }) {
  const rows = useMemo(() => burndownRows(sprint, cards), [sprint, cards])
  const latest = rows.filter((r) => r.remaining !== null).at(-1)

  // Everything paints with currentColor: the wrapper makes axes and grid
  // muted ink, and the marks group alone takes the series color, in both
  // themes.
  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          lineY(rows, {
            x: 'day',
            y: 'ideal',
            stroke: 'currentColor',
            strokeOpacity: 0.45,
            strokeWidth: 1.5,
            strokeDasharray: '4 4',
          }),
          lineY(rows, {
            x: 'day',
            y: 'remaining',
            stroke: 'currentColor',
            strokeWidth: 2,
            points: true,
          }),
          crosshair({ x: { label: true }, y: false }),
        ],
        scales: {
          x: { scale: scalePoint },
          y: {
            scale: () => scaleLinear().domain([0, Math.max(1, cards.length)]),
            grid: true,
            axis: { label: 'Open cards' },
          },
        },
        focus: 'nearest-x',
        maxFocusDistance: Number.POSITIVE_INFINITY,
        tooltip,
      }),
    [rows, cards.length],
  )

  return (
    <figure className="flex min-w-0 flex-col gap-1.5">
      <div className="text-muted-foreground [&_.ts-chart\_\_marks]:text-primary [&_.ts-chart\_\_focus-layer]:text-primary">
        <Chart
          definition={definition}
          aspectRatio={3.2}
          initialWidth={360}
          ariaLabel={`Burndown for ${sprint.name}`}
          ariaDescription={
            latest
              ? `${cards.length} cards at the start, ${latest.remaining} still open on ${latest.day}. The ideal line reaches zero on ${rows.at(-1)?.day}.`
              : `The sprint starts on ${rows[0]?.day}.`
          }
        />
      </div>
      <figcaption className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded-full bg-primary" />
          Open cards
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 border-t-[1.5px] border-dashed border-primary/45" />
          Ideal
        </span>
      </figcaption>
    </figure>
  )
}
