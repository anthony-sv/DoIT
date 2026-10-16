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
import { toast } from '@/components/ui/toast'
import { closeSprint } from '@/data/actions'
import type { Card, Sprint } from '@/data/schemas'

export function CloseSprintDialog({
  sprint,
  unfinished,
  next,
}: {
  sprint: Sprint
  unfinished: Card[]
  next: Sprint | null
}) {
  const [carry, setCarry] = useState<'next' | 'backlog'>(next ? 'next' : 'backlog')
  const target = carry === 'next' ? next : null

  return (
    <AlertDialog>
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
              value={carry}
              onValueChange={(value) => setCarry(value === 'next' ? 'next' : 'backlog')}
            >
              <Field orientation="horizontal" data-disabled={!next || undefined}>
                <RadioGroupItem value="next" id="carry-next" disabled={!next} />
                <FieldContent>
                  <FieldLabel htmlFor="carry-next">
                    Move them to {next ? next.name : 'the next sprint'}
                  </FieldLabel>
                  {!next ? (
                    <FieldDescription>Plan the next sprint first to use this.</FieldDescription>
                  ) : null}
                </FieldContent>
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
