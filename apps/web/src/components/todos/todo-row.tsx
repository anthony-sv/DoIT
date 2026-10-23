import { type Ref, createContext, useContext, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link } from '@tanstack/react-router'
import { useSortable } from '@dnd-kit/react/sortable'
import { CalendarIcon, GripVerticalIcon, KanbanIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { todosCollection } from '@/data/collections'
import type { Todo } from '@/data/schemas'
import { dueInfo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { TodoDuePicker } from './todo-due-picker'

// Row actions appear on hover or focus; touch screens have no hover, so
// they always show there.
const rowAction =
  'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100'

function reportFailure(what: string) {
  return (error: Error) => toast.add({ title: what, description: error.message, type: 'error' })
}

/** Where the card an imported todo came from lives. */
export type CardLink = { cardId: string; boardId: string; key: string }

// By card id, filled by the todos page from one live query rather than one
// per row. A card that is gone, or that you can no longer see, has no entry,
// so its todo shows no link.
export const CardLinks = createContext<ReadonlyMap<string, CardLink>>(new Map())

export function SortableTodo({
  index,
  listId,
  todo,
}: {
  index: number
  listId: string
  todo: Todo
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id: todo.id,
    index,
    group: listId,
    type: 'todo',
    accept: 'todo',
  })
  return <TodoRow ref={ref} handleRef={handleRef} dragging={isDragging} todo={todo} />
}

export function TodoRow({
  ref,
  handleRef,
  dragging,
  todo,
}: {
  ref?: Ref<HTMLLIElement>
  handleRef?: Ref<HTMLButtonElement>
  dragging?: boolean
  todo: Todo
}) {
  const due = todo.due_on ? dueInfo(todo.due_on, todo.done) : null
  const links = useContext(CardLinks)
  const link = todo.card_id ? links.get(todo.card_id) : undefined

  return (
    <li
      ref={ref}
      className={cn(
        'group flex min-h-11 flex-wrap items-center gap-x-3 border-b px-2',
        dragging && 'relative z-10 rounded-lg border-transparent bg-card shadow-lg ring-2 ring-primary',
      )}
    >
      {handleRef ? (
        <button
          ref={handleRef}
          type="button"
          aria-label={`Move “${todo.text}”`}
          className="cursor-grab rounded text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        >
          <GripVerticalIcon className="size-4" />
        </button>
      ) : (
        // Completed todos stay put; this keeps their checkboxes in line.
        <span className="size-4 shrink-0" />
      )}
      <Checkbox
        aria-label={todo.text}
        checked={todo.done}
        onCheckedChange={(checked) =>
          todosCollection
            .update(todo.id, (d) => {
              d.done = checked === true
            })
            .isPersisted.promise.catch(reportFailure('Todo not saved'))
        }
      />
      <TodoText todo={todo} />
      {/* On a phone the link and due chip would leave the text a few
          characters wide, so they take a line of their own under it
          (pl-14 lines up with the text), actions on the right. */}
      <div
        className={cn(
          'flex shrink-0 items-center gap-1',
          (link || due) && 'max-sm:-mt-1.5 max-sm:mb-1.5 max-sm:basis-full max-sm:pl-14',
        )}
      >
        {link ? (
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            aria-label={`Open ${link.key} on its board`}
            className="text-muted-foreground"
            render={
              <Link
                to="/b/$boardId"
                params={{ boardId: link.boardId }}
                search={{ card: link.cardId }}
              />
            }
          >
            <KanbanIcon />
          </Button>
        ) : null}
        {due ? <DueChip due={due} /> : null}
        <TodoDuePicker todo={todo} className={cn(rowAction, 'ml-auto')} />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete “${todo.text}”`}
          className={rowAction}
          onClick={() =>
            todosCollection.delete(todo.id).isPersisted.promise.catch(reportFailure('Todo not deleted'))
          }
        >
          <XIcon />
        </Button>
      </div>
    </li>
  )
}

function TodoText({ todo }: { todo: Todo }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(todo.text)
  const textRef = useRef<HTMLButtonElement>(null)

  function save() {
    const trimmed = text.trim()
    if (trimmed && trimmed !== todo.text) {
      todosCollection
        .update(todo.id, (d) => {
          d.text = trimmed
        })
        .isPersisted.promise.catch(reportFailure('Todo not saved'))
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <Input
        autoFocus
        aria-label="Todo"
        maxLength={300}
        className="flex-1"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== 'Escape') return
          // Cancelling the keydown stops Enter's keypress from clicking the
          // button that takes focus below, which would reopen the editor.
          e.preventDefault()
          // Hand focus back to the text, as if the input had never been there.
          flushSync(() => (e.key === 'Enter' ? save() : setEditing(false)))
          textRef.current?.focus()
        }}
      />
    )
  }

  return (
    <button
      ref={textRef}
      type="button"
      aria-label={`Edit “${todo.text}”`}
      className={cn(
        'min-w-0 flex-1 cursor-text rounded py-2.5 text-left text-sm wrap-break-word outline-none focus-visible:ring-2 focus-visible:ring-ring',
        todo.done && 'text-muted-foreground line-through',
      )}
      onClick={() => {
        setText(todo.text)
        setEditing(true)
      }}
    >
      {todo.text}
    </button>
  )
}

export function DueChip({ due }: { due: ReturnType<typeof dueInfo> }) {
  return (
    <span
      className={cn(
        'flex items-center gap-1 rounded-md text-xs whitespace-nowrap text-muted-foreground',
        due.state === 'overdue' && 'bg-label-red px-1.5 font-medium text-label-red-foreground',
        due.state === 'soon' && 'bg-label-amber px-1.5 font-medium text-label-amber-foreground',
      )}
    >
      {due.state === 'later' ? <CalendarIcon className="size-3.5" /> : null}
      {due.label}
    </span>
  )
}
