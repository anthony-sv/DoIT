import { type Ref, useState } from 'react'
import { EllipsisIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/toast'
import { removeSprint } from '@/data/actions'
import type { Sprint } from '@/data/schemas'

function deleteMessage(sprint: Sprint, cardCount: number) {
  if (cardCount === 0) return `${sprint.name} is deleted. It has no cards, so nothing else changes.`
  const cards = cardCount === 1 ? 'Its card stays' : `Its ${cardCount} cards stay`
  if (sprint.state === 'closed') return `${sprint.name} is deleted. ${cards} on the board without a sprint.`
  // The backlog lists only unfinished cards (planning.ts); done ones just lose the sprint.
  const unfinished = cardCount === 1 ? 'If it isn’t done, it goes' : 'Any that aren’t done go'
  return `${sprint.name} is deleted. ${cards} on the board. ${unfinished} back to the backlog.`
}

/**
 * The "…" menu of a sprint. Without `onEditingChange` it only offers to delete
 * (closed sprints).
 */
export function SprintMenu({
  sprint,
  cardCount,
  editing = false,
  onEditingChange,
  triggerRef,
}: {
  sprint: Sprint
  cardCount: number
  editing?: boolean
  onEditingChange?: (editing: boolean) => void
  triggerRef?: Ref<HTMLButtonElement>
}) {
  const [deleting, setDeleting] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              ref={triggerRef}
              variant="ghost"
              size="icon-sm"
              aria-label={`${sprint.name} options`}
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {onEditingChange ? (
            <>
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => onEditingChange(!editing)}>
                  <PencilIcon />
                  {editing ? 'Done editing' : 'Edit details'}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
              <Trash2Icon />
              Delete sprint…
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {sprint.name}?</AlertDialogTitle>
            <AlertDialogDescription>{deleteMessage(sprint, cardCount)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                removeSprint(sprint).isPersisted.promise.catch((error: Error) =>
                  toast.add({ title: 'Sprint not deleted', description: error.message, type: 'error' }),
                )
                setDeleting(false)
              }}
            >
              Delete sprint
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
