import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { CircleCheckIcon } from 'lucide-react'
import { AddSection, TodoSections } from '@/components/todos/todo-sections'
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
import { todoSectionsCollection, todosCollection } from '@/data/collections'
import { currentUserId } from '@/lib/auth'
import { positionBetween } from '@/lib/position'

export const Route = createFileRoute('/_app/todos')({
  head: () => ({ meta: [{ title: 'My todos · DoIT' }] }),
  component: TodosPage,
})

function reportFailure(what: string) {
  return (error: Error) => toast.add({ title: what, description: error.message, type: 'error' })
}

function TodosPage() {
  const [text, setText] = useState('')
  const { data: sections } = useLiveQuery({
    query: (q) =>
      q.from({ section: todoSectionsCollection }).orderBy(({ section }) => section.position),
  })
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
        .orderBy(({ todo }) => todo.position, 'desc'),
  })

  function add() {
    const trimmed = text.trim()
    if (!trimmed) return
    // Newest on top of the inbox, above its completed todos too, so
    // unchecking one never lands on the same spot as the new one.
    const inbox = todosCollection.toArray
      .filter((t) => t.section_id === null)
      .map((t) => t.position)
      .sort((a, b) => a - b)
    todosCollection
      .insert({
        id: crypto.randomUUID(),
        owner_id: currentUserId(),
        section_id: null,
        text: trimmed,
        done: false,
        due_on: null,
        position: positionBetween(undefined, inbox[0]),
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
          Small things that don’t need a card, grouped however you like.
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
          maxLength={300}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </form>

      {sections.length === 0 && open.length === 0 && done.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleCheckIcon />
            </EmptyMedia>
            <EmptyTitle>Nothing to do</EmptyTitle>
            <EmptyDescription>Add a todo above, or a section below to group them.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <TodoSections sections={sections} open={open} done={done} />
      )}

      <AddSection sections={sections} />
    </div>
  )
}
