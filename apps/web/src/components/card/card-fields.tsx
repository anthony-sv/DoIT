// Editors for a card's fields, shared by the card sheet, the table and the
// story board. They write through card-writes.ts.
import { useState } from 'react'
import { PersonAvatar } from '@/components/person-avatar'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { type Card, type Story, labelColors } from '@/data/schemas'
import type { BoardPerson } from '@/hooks/use-board-people'
import { colorClasses, colorNames } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { parseEstimate } from '@/lib/estimate'
import { assigneeEmail, setAssignee, updateCard } from './card-writes'

// Select and toggle values can't be null; this stands for "none".
const NONE = 'none'

export function AssigneeSelect({ card, people }: { card: Card; people: BoardPerson[] }) {
  return (
    <Select
      value={card.assignee_id ?? NONE}
      onValueChange={(value) => setAssignee(card, people, !value || value === NONE ? null : value)}
    >
      <SelectTrigger size="sm" aria-label="Assignee" className="max-w-full">
        <SelectValue>
          {(value: string) =>
            value === NONE ? (
              <span className="text-muted-foreground">Unassigned</span>
            ) : (
              <>
                <PersonAvatar email={assigneeEmail(people, value)} size="xs" />
                <span className="truncate">{assigneeEmail(people, value)}</span>
              </>
            )
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={NONE}>Unassigned</SelectItem>
          {people.map((person) => (
            <SelectItem key={person.userId} value={person.userId}>
              <PersonAvatar email={person.email} size="xs" />
              {person.email}
              {person.isYou ? <span className="text-muted-foreground">(you)</span> : null}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function StorySelect({ card, stories }: { card: Card; stories: Story[] }) {
  return (
    <Select
      value={card.story_id ?? NONE}
      onValueChange={(value) => {
        const storyId = !value || value === NONE ? null : value
        if (storyId === card.story_id) return
        updateCard(card.id, 'Story not saved', (d) => {
          d.story_id = storyId
        })
      }}
    >
      <SelectTrigger size="sm" aria-label="Story" className="max-w-full">
        <SelectValue>
          {(value: string) =>
            value === NONE ? (
              <span className="text-muted-foreground">No story</span>
            ) : (
              (stories.find((s) => s.id === value)?.title ?? 'Deleted story')
            )
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={NONE}>No story</SelectItem>
          {stories.map((story) => (
            <SelectItem key={story.id} value={story.id}>
              {story.title}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function estimateText(estimate: number | null) {
  return estimate === null ? '' : String(estimate)
}

/** Days of work, saved on blur or Enter; Escape puts back the saved value. */
export function EstimateInput({
  card,
  label = 'Estimate in days',
  className,
}: {
  card: Card
  /** The input's accessible name; a table names the card in it. */
  label?: string
  className?: string
}) {
  const [text, setText] = useState(estimateText(card.estimate))
  // Follow edits that arrive from elsewhere (another view, a teammate).
  const [seen, setSeen] = useState(card.estimate)
  if (seen !== card.estimate) {
    setSeen(card.estimate)
    setText(estimateText(card.estimate))
  }
  const invalid = parseEstimate(text) === undefined

  function save() {
    const value = parseEstimate(text)
    if (value === undefined) {
      setText(estimateText(card.estimate))
      return
    }
    setText(estimateText(value))
    if (value !== card.estimate) {
      updateCard(card.id, 'Estimate not saved', (d) => {
        d.estimate = value
      })
    }
  }

  return (
    <InputGroup className={cn('w-28 max-w-full', className)}>
      <InputGroupInput
        inputMode="decimal"
        aria-label={label}
        aria-invalid={invalid || undefined}
        placeholder="–"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') setText(estimateText(card.estimate))
        }}
      />
      <InputGroupAddon align="inline-end">days</InputGroupAddon>
    </InputGroup>
  )
}

/** A tint from the label palette, or none for a plain card. */
export function CardColorPicker({ card }: { card: Card }) {
  return (
    <ToggleGroup
      aria-label="Card color"
      value={[card.color ?? NONE]}
      onValueChange={(next) => {
        // Single choice: ignore clicks that would clear it.
        if (next.length === 0) return
        const color = labelColors.find((c) => c === next[0]) ?? null
        if (color === card.color) return
        updateCard(card.id, 'Color not saved', (d) => {
          d.color = color
        })
      }}
      spacing={1}
      className="flex-wrap"
    >
      <ToggleGroupItem
        value={NONE}
        size="sm"
        aria-label="No color"
        title="No color"
        className="data-pressed:ring-2 data-pressed:ring-ring"
      >
        <span className="size-3.5 rounded-full border-2 border-dashed border-muted-foreground" />
      </ToggleGroupItem>
      {labelColors.map((color) => (
        <ToggleGroupItem
          key={color}
          value={color}
          size="sm"
          aria-label={colorNames[color]}
          title={colorNames[color]}
          className="data-pressed:ring-2 data-pressed:ring-ring"
        >
          <span className={cn('size-3.5 rounded-full', colorClasses[color].dot)} />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
