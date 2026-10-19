import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldContent, FieldDescription, FieldLabel, FieldSet } from '@/components/ui/field'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/toast'
import { closeSprint } from '@/data/actions'
import type { Card, Sprint } from '@/data/schemas'

export function CloseSprintDialog({
  sprint,
  unfinished,
  planned,
}: {
  sprint: Sprint
  unfinished: Card[]
  /** Sprints the unfinished cards can move to, earliest first. */
  planned: Sprint[]
}) {
  const [carry, setCarry] = useState<'next' | 'backlog'>('next')
  const [nextId, setNextId] = useState<string | null>(null)
  const next = planned.find((s) => s.id === nextId) ?? planned[0] ?? null
  // With nothing planned the cards can only go back to the backlog.
  const choice = next ? carry : 'backlog'
  const target = choice === 'next' ? next : null

  return (
    <AlertDialog
      onOpenChange={(open) => {
        // Each time it opens, suggest the earliest planned sprint.
        if (open) {
          setCarry('next')
          setNextId(null)
        }
      }}
    >
      <AlertDialogTrigger render={<Button variant="outline" />}>
        Close {sprint.name}…
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Close {sprint.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {unfinished.length === 0
              ? 'Every card is done. Finished cards stay with the sprint as its record.'
              : `${unfinished.length} ${unfinished.length === 1 ? 'card isn’t' : 'cards aren’t'} done. Finished cards stay with the sprint as its record.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {unfinished.length > 0 ? (
          <FieldSet>
            <RadioGroup
              value={choice}
              onValueChange={(value) => setCarry(value === 'next' ? 'next' : 'backlog')}
            >
              <Field orientation="horizontal" data-disabled={!next || undefined}>
                <RadioGroupItem value="next" id="carry-next" disabled={!next} />
                {next ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <FieldLabel htmlFor="carry-next">Move them to</FieldLabel>
                    <Select
                      value={next.id}
                      onValueChange={(id) => {
                        if (!id) return
                        setNextId(id)
                        setCarry('next')
                      }}
                    >
                      <SelectTrigger size="sm" aria-label="Sprint to move them to">
                        <SelectValue>
                          {(id: string) => planned.find((s) => s.id === id)?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {planned.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <FieldContent>
                    <FieldLabel htmlFor="carry-next">Move them to the next sprint</FieldLabel>
                    <FieldDescription>Plan the next sprint first to use this.</FieldDescription>
                  </FieldContent>
                )}
              </Field>
              <Field orientation="horizontal">
                <RadioGroupItem value="backlog" id="carry-backlog" />
                <FieldLabel htmlFor="carry-backlog">Put them back in the backlog</FieldLabel>
              </Field>
            </RadioGroup>
          </FieldSet>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              closeSprint(sprint, unfinished, target).isPersisted.promise.catch((error: Error) =>
                toast.add({ title: 'Sprint not closed', description: error.message, type: 'error' }),
              )
            }
          >
            Close sprint
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
