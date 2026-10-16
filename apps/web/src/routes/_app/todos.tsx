import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { CircleCheckIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { toast } from '@/components/ui/toast'
import { todosCollection } from '@/data/collections'
import type { Todo } from '@/data/schemas'
import { currentUserId } from '@/lib/auth'
import { positionBetween } from '@/lib/position'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/todos')({
  head: () => ({ meta: [{ title: 'My todos · DoIT' }] }),
  component: TodosPage,
})

function reportFailure(what: string) {
  return (error: Error) => toast.add({ title: what, description: error.message, type: 'error' })
}

function TodosPage() {
  const [text, setText] = useState('')
  const { data: open } = useLiveQuery({
    query: (q) =>
      q
        .from({ todo: todosCollection })
        .where(({ todo }) => eq(todo.done, false))
        .orderBy(({ todo }) => todo.position),
  })
  const { data: done } = useLiveQuery({
    query: (q) =>
      q
        .from({ todo: todosCollection })
        .where(({ todo }) => eq(todo.done, true))
        .orderBy(({ todo }) => todo.position, 'desc')
        .limit(20),
  })

  function add() {
    const trimmed = text.trim()
    if (!trimmed) return
    todosCollection
      .insert({
        id: crypto.randomUUID(),
        owner_id: currentUserId(),
        text: trimmed,
        done: false,
        due_on: null,
        // Newest on top.
        position: positionBetween(undefined, open[0]?.position),
        created_at: new Date().toISOString(),
      })
      .isPersisted.promise.catch(reportFailure('Todo not saved'))
    setText('')
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 px-4 py-5 sm:px-7">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <SidebarTrigger className="-ml-1.5 md:hidden" />
          Personal
        </div>
        <h1 className="text-2xl font-bold tracking-tight">My todos</h1>
        <p className="text-sm text-muted-foreground">
          Small things that don’t need a card. They stay out of every board.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <Input
          autoFocus
          aria-label="New todo"
          placeholder="Add a todo and press Enter"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </form>

      {open.length === 0 && done.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleCheckIcon />
            </EmptyMedia>
            <EmptyTitle>Nothing to do</EmptyTitle>
            <EmptyDescription>Add a todo above.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col">
          {open.map((todo) => (
            <TodoRow key={todo.id} todo={todo} />
          ))}
        </ul>
      )}

      {done.length > 0 ? (
        <section aria-labelledby="done-heading" className="flex flex-col gap-1">
          <h2 id="done-heading" className="text-sm font-semibold text-muted-foreground">
            Done
          </h2>
          <ul className="flex flex-col">
            {done.map((todo) => (
              <TodoRow key={todo.id} todo={todo} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function TodoRow({ todo }: { todo: Todo }) {
  return (
    <li className="group flex min-h-11 items-center gap-3 border-b">
      <Checkbox
        id={`todo-${todo.id}`}
        checked={todo.done}
        onCheckedChange={(checked) =>
          todosCollection
            .update(todo.id, (d) => {
              d.done = checked === true
            })
            .isPersisted.promise.catch(reportFailure('Todo not saved'))
        }
      />
      <label
        htmlFor={`todo-${todo.id}`}
        className={cn('flex-1 text-sm', todo.done && 'text-muted-foreground line-through')}
      >
        {todo.text}
      </label>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete “${todo.text}”`}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={() =>
          todosCollection.delete(todo.id).isPersisted.promise.catch(reportFailure('Todo not deleted'))
        }
      >
        <XIcon />
      </Button>
    </li>
  )
}
