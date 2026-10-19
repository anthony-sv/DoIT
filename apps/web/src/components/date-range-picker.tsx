import { useId, useState } from 'react'
import { parseISO } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useIsMobile } from '@/hooks/use-mobile'
import { type DayRange, lengthInDays, rangeLength, toDay as day, weeksFrom } from '@/lib/date-range'
import { sprintRange } from '@/lib/format'
import { cn } from '@/lib/utils'

const presets = [1, 2, 3, 4]

/**
 * A button showing the range; it opens a calendar where two clicks pick a new
 * range, or a preset sets the length from the current start. `onChange` gets
 * both days at once, with `to` never before `from`.
 */
export function DateRangePicker({
  value,
  onChange,
  id,
  'aria-label': ariaLabel,
}: {
  value: DayRange
  onChange: (next: DayRange) => void
  id?: string
  'aria-label'?: string
}) {
  const isMobile = useIsMobile()
  const valueId = useId()
  const [open, setOpen] = useState(false)
  // The first click of a new range. It is only shown until the second click
  // saves the range, and dropped if the popover closes first.
  const [start, setStart] = useState<Date>()
  const from = parseISO(value.from)
  const days = lengthInDays(value)

  function pick(next: DayRange) {
    setStart(undefined)
    setOpen(false)
    if (next.from !== value.from || next.to !== value.to) onChange(next)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setStart(undefined)
      }}
    >
      <PopoverTrigger
        id={id}
        aria-label={ariaLabel}
        // A label names the button, so the dates go in its description.
        aria-describedby={valueId}
        render={<Button variant="outline" className="justify-start font-normal" />}
      >
        <CalendarIcon data-icon="inline-start" />
        <span id={valueId} className="min-w-0 truncate">
          {sprintRange(value.from, value.to)} · {rangeLength(value)}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-0 p-0">
        <Calendar
          mode="range"
          required
          // With a whole range selected, a click starts a new range instead of
          // moving one of its ends.
          resetOnSelect
          numberOfMonths={isMobile ? 1 : 2}
          // Side by side, the other month's days would show twice.
          showOutsideDays={isMobile}
          defaultMonth={from}
          selected={start ? { from: start } : { from, to: parseISO(value.to) }}
          onSelect={(range) => {
            if (range.from && range.to) pick({ from: day(range.from), to: day(range.to) })
            else setStart(range.from)
          }}
          className={cn(
            // Finger-sized days on a phone.
            '[--cell-size:--spacing(10)] md:[--cell-size:--spacing(7)]',
            // The calendar marks the days in a range with bg-muted, which is
            // nearly the popover's own color in dark mode. Accent shows in both.
            // Tailwind reads a bare `_` as a space, hence `\_` in the class names.
            String.raw`[&_.rdp-range\_end]:bg-accent [&_.rdp-range\_end]:after:bg-accent [&_.rdp-range\_start]:bg-accent [&_.rdp-range\_start]:after:bg-accent`,
            '[&_[data-range-middle=true]]:bg-accent! [&_[data-range-middle=true]]:text-accent-foreground!',
          )}
        />
        <Separator />
        <ToggleGroup
          aria-label="Length"
          variant="outline"
          size="sm"
          spacing={1}
          className="flex-wrap p-2"
          value={!start && days % 7 === 0 ? [String(days / 7)] : []}
          onValueChange={(pressed) => {
            const weeks = Number(pressed[0])
            if (weeks > 0) pick(weeksFrom(start ? day(start) : value.from, weeks))
          }}
        >
          {presets.map((weeks) => (
            <ToggleGroupItem key={weeks} value={String(weeks)}>
              {weeks === 1 ? '1 week' : `${weeks} weeks`}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </PopoverContent>
    </Popover>
  )
}
