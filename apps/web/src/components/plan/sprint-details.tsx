import { useId, useState } from 'react'
import { DateRangePicker } from '@/components/date-range-picker'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { sprintsCollection } from '@/data/collections'
import type { Sprint } from '@/data/schemas'

function save(sprint: Sprint, change: (draft: Sprint) => void) {
  const fail = (error: Error) =>
    toast.add({ title: 'Sprint not saved', description: error.message, type: 'error' })
  try {
    sprintsCollection.update(sprint.id, change).isPersisted.promise.catch(fail)
  } catch (error) {
    // Schema checks run synchronously, before any transaction exists.
    fail(error as Error)
  }
}

/**
 * Name, dates and goal of a sprint. Name and goal save when they lose focus,
 * dates as soon as a range is picked.
 */
export function SprintDetails({ sprint }: { sprint: Sprint }) {
  // Several sprints can be open for editing at once.
  const id = useId()
  const [name, setName] = useState(sprint.name)
  const [goal, setGoal] = useState(sprint.goal)
  // Follow edits that arrive from elsewhere (another tab, a refetch).
  const [seen, setSeen] = useState(sprint)
  if (seen.name !== sprint.name || seen.goal !== sprint.goal) {
    setSeen(sprint)
    setName(sprint.name)
    setGoal(sprint.goal)
  }

  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
        <Input
          id={`${id}-name`}
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const trimmed = name.trim()
            if (!trimmed) setName(sprint.name)
            else if (trimmed !== sprint.name) save(sprint, (d) => void (d.name = trimmed))
          }}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-dates`}>Dates</FieldLabel>
        <DateRangePicker
          id={`${id}-dates`}
          value={{ from: sprint.starts_on, to: sprint.ends_on }}
          // One update: Postgres checks that the end isn't before the start.
          onChange={({ from, to }) =>
            save(sprint, (d) => {
              d.starts_on = from
              d.ends_on = to
            })
          }
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-goal`}>Sprint goal</FieldLabel>
        <Textarea
          id={`${id}-goal`}
          rows={2}
          placeholder="What should be true when this sprint ends?"
          maxLength={500}
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
