import { type ReactNode, useId, useRef } from 'react'
import { flushSync } from 'react-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card as Panel,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/ui/toast'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { startSprint } from '@/data/actions'
import type { Sprint } from '@/data/schemas'
import { daysLabel, sprintRange } from '@/lib/format'
import { cardsLabel } from './planning'
import { SprintDetails } from './sprint-details'
import { SprintMenu } from './sprint-menu'

/** An active or planned sprint: header, actions, details editor and its card list (`children`). */
export function SprintPanel({
  sprint,
  running,
  cardCount,
  estimate,
  editing,
  onEditingChange,
  children,
}: {
  sprint: Sprint
  /** The board's active sprint, if there is one. */
  running: Sprint | undefined
  cardCount: number
  /** Days estimated across its cards. */
  estimate: number
  editing: boolean
  onEditingChange: (editing: boolean) => void
  children: ReactNode
}) {
  const optionsRef = useRef<HTMLButtonElement>(null)
  return (
    <Panel className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {sprint.name}
          {sprint.state === 'active' ? (
            <Badge variant="secondary" className="bg-label-green text-label-green-foreground">
              Active
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          {sprintRange(sprint.starts_on, sprint.ends_on)} · {cardsLabel(cardCount)}
          {estimate > 0 ? ` · ${daysLabel(estimate, 'long')}` : null}
        </CardDescription>
        {sprint.goal ? <CardDescription>{sprint.goal}</CardDescription> : null}
        <CardAction className="flex items-center gap-1">
          {sprint.state === 'planned' ? <StartSprint sprint={sprint} running={running} /> : null}
          <SprintMenu
            sprint={sprint}
            cardCount={cardCount}
            editing={editing}
            onEditingChange={onEditingChange}
            triggerRef={optionsRef}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {editing ? (
          <>
            <SprintDetails sprint={sprint} />
            <Button
              variant="outline"
              size="sm"
              className="self-end"
              onClick={() => {
                // This button leaves with the editor; hand focus to the menu that reopens it.
                flushSync(() => onEditingChange(false))
                optionsRef.current?.focus()
              }}
            >
              Done
            </Button>
            <Separator />
          </>
        ) : null}
        {children}
      </CardContent>
    </Panel>
  )
}

function StartSprint({ sprint, running }: { sprint: Sprint; running: Sprint | undefined }) {
  const reasonId = useId()
  if (!running) {
    return (
      <Button
        size="sm"
        onClick={() =>
          startSprint(sprint).isPersisted.promise.catch((error: Error) =>
            toast.add({ title: 'Sprint not started', description: error.message, type: 'error' }),
          )
        }
      >
        Start sprint
      </Button>
    )
  }

  // A board runs one sprint at a time. focusableWhenDisabled renders
  // aria-disabled instead of disabled, so the button stays focusable and
  // hoverable as the tooltip trigger, and needs its own dimmed style. Base UI
  // tooltips aren't announced, so the reason is also the button's description.
  const reason = `Close ${running.name} first`
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size="sm"
              disabled
              focusableWhenDisabled
              aria-describedby={reasonId}
              className="aria-disabled:opacity-50 aria-disabled:hover:bg-primary"
            />
          }
        >
          Start sprint
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
      {/* Outside the button, or it would join the button's name. */}
      <span id={reasonId} className="sr-only">
        {reason}
      </span>
    </>
  )
}
