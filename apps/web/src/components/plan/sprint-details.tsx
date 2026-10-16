import { useState } from 'react'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { sprintsCollection } from '@/data/collections'
import type { Sprint } from '@/data/schemas'

function save(sprint: Sprint, change: (draft: Sprint) => void) {
  sprintsCollection
    .update(sprint.id, change)
    .isPersisted.promise.catch((error: Error) =>
      toast.add({ title: 'Sprint not saved', description: error.message, type: 'error' }),
    )
}

/** Name, dates and goal of a planned sprint; each field saves when it loses focus. */
export function SprintDetails({ sprint }: { sprint: Sprint }) {
  const [name, setName] = useState(sprint.name)
  const [goal, setGoal] = useState(sprint.goal)
  // Follow edits that arrive from elsewhere (another tab, a refetch).
  const [seen, setSeen] = useState(sprint)
  if (seen.name !== sprint.name || seen.goal !== sprint.goal) {
    setSeen(sprint)
    setName(sprint.name)
    setGoal(sprint.goal)
  }
  const badDates = sprint.ends_on < sprint.starts_on

  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel htmlFor="sprint-name">Name</FieldLabel>
        <Input
          id="sprint-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const trimmed = name.trim()
            if (!trimmed) setName(sprint.name)
            else if (trimmed !== sprint.name) save(sprint, (d) => void (d.name = trimmed))
          }}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="sprint-start">Starts</FieldLabel>
          <Input
            id="sprint-start"
            type="date"
            value={sprint.starts_on}
            onChange={(e) => {
              const value = e.target.value
              if (value && value <= sprint.ends_on) save(sprint, (d) => void (d.starts_on = value))
            }}
          />
        </Field>
        <Field data-invalid={badDates || undefined}>
          <FieldLabel htmlFor="sprint-end">Ends</FieldLabel>
          <Input
            id="sprint-end"
            type="date"
            min={sprint.starts_on}
            value={sprint.ends_on}
            aria-invalid={badDates || undefined}
            onChange={(e) => {
              const value = e.target.value
              if (value && value >= sprint.starts_on) save(sprint, (d) => void (d.ends_on = value))
            }}
          />
          {badDates ? <FieldError>The end comes before the start.</FieldError> : null}
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="sprint-goal">Sprint goal</FieldLabel>
        <Textarea
          id="sprint-goal"
          rows={2}
          placeholder="What should be true when this sprint ends?"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onBlur={() => {
            if (goal.trim() !== sprint.goal) save(sprint, (d) => void (d.goal = goal.trim()))
          }}
        />
      </Field>
    </FieldGroup>
  )
}
