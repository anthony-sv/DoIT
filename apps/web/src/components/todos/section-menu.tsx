import { useState } from 'react'
import { EllipsisIcon, ListXIcon, PencilIcon, Trash2Icon } from 'lucide-react'
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
import { todosCollection } from '@/data/collections'
import { removeTodoSection } from '@/data/actions'
import type { TodoSection } from '@/data/schemas'

function reportFailure(what: string) {
  return (error: Error) => toast.add({ title: what, description: error.message, type: 'error' })
}

// PostgREST reads filters from the URL (about 39 bytes per id) and Supabase's
// gateway rejects requests past about 16KB of URL and headers, so a long
// completed list is deleted in batches, each its own transaction: one that
// fails comes back alone and the rest stay deleted.
const DELETE_BATCH = 100

function deleteTodos(ids: string[]) {
  const saves: Array<Promise<unknown>> = []
  for (let i = 0; i < ids.length; i += DELETE_BATCH) {
    saves.push(todosCollection.delete(ids.slice(i, i + DELETE_BATCH)).isPersisted.promise)
  }
  return Promise.all(saves)
}

/** Options for one section; the inbox (`section` null) can only be cleared. */
export function SectionMenu({
  section,
  name,
  doneIds,
  todoCount,
  onRename,
  className,
}: {
  section: TodoSection | null
  name: string
  doneIds: string[]
  todoCount: number
  onRename: () => void
  className?: string
}) {
  const [clearing, setClearing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className={className}
              aria-label={`${name} section options`}
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            {section ? (
              <DropdownMenuItem onClick={onRename}>
                <PencilIcon />
                Rename
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem disabled={doneIds.length === 0} onClick={() => setClearing(true)}>
              <ListXIcon />
              Clear completed…
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {section ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
                  <Trash2Icon />
                  Delete section…
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={clearing} onOpenChange={setClearing}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear completed in {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {doneIds.length} completed {doneIds.length === 1 ? 'todo is' : 'todos are'} deleted
              for good.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                deleteTodos(doneIds).catch(reportFailure('Todos not deleted'))
                setClearing(false)
              }}
            >
              Clear completed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {section ? (
        <AlertDialog open={deleting} onOpenChange={setDeleting}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{section.name}”?</AlertDialogTitle>
              <AlertDialogDescription>
                {todoCount === 0
                  ? 'The section is empty, so nothing else changes.'
                  : `Its ${todoCount} ${todoCount === 1 ? 'todo moves' : 'todos move'} to the inbox.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  removeTodoSection(section).isPersisted.promise.catch(
                    reportFailure('Section not deleted'),
                  )
                  setDeleting(false)
                }}
              >
                Delete section
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  )
}
