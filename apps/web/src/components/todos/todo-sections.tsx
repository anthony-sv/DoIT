import { useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { DragDropProvider, KeyboardSensor, PointerSensor } from '@dnd-kit/react'
import { isSortable } from '@dnd-kit/react/sortable'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { todoSectionsCollection, todosCollection } from '@/data/collections'
import type { Todo, TodoSection } from '@/data/schemas'
import { currentUserId } from '@/lib/auth'
import { placeAt, positionAfterLast, positionBetween, withItemAt } from '@/lib/position'
import {
  INBOX,
  positionBetweenOpen,
  readCollapsed,
  rememberCollapsed,
  todoLists,
} from '@/lib/todos'
import { Section, type SectionProps, SortableSection } from './todo-section'

type Lists = Record<string, string[]>

// Enter edits a todo; only Space picks one up with the keyboard.
const sensors = [
  PointerSensor,
  KeyboardSensor.configure({
    keyboardCodes: {
      start: ['Space'],
      cancel: ['Escape'],
      end: ['Space', 'Tab'],
      up: ['ArrowUp'],
      down: ['ArrowDown'],
      left: ['ArrowLeft'],
      right: ['ArrowRight'],
    },
  }),
]

function reportFailure(what: string) {
  return (error: Error) => toast.add({ title: what, description: error.message, type: 'error' })
}

/** `ids` with `id` in it or not. */
function including(ids: string[], id: string, on: boolean) {
  const rest = ids.filter((x) => x !== id)
  return on ? [...rest, id] : rest
}

/** The inbox and the user's sections, with todos sortable within and across them. */
export function TodoSections({
  sections,
  open,
  done,
}: {
  sections: TodoSection[]
  open: Todo[]
  done: Todo[]
}) {
  const order = useMemo(() => sections.map((s) => s.id), [sections])
  const derived = useMemo(() => todoLists(order, open), [order, open])
  const doneLists = useMemo(() => todoLists(order, done), [order, done])
  const todosById = useMemo(() => new Map([...open, ...done].map((t) => [t.id, t])), [open, done])
  const sectionsById = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections])

  // dnd-kit moves rows and sections in the DOM while dragging; after a drop
  // or a cancel they remount so React never reconciles those moved nodes (see
  // board-columns). What the user opened or folded lives up here so the
  // remount keeps it.
  const [generation, setGeneration] = useState(0)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [showDone, setShowDone] = useState<string[]>([])

  function dropTodo(todoId: string, final: Lists) {
    const todo = todosById.get(todoId)
    const listId = Object.keys(final).find((k) => final[k]!.includes(todoId))
    if (!todo || !listId) return
    const list = final[listId]!
    const index = list.indexOf(todoId)
    const before = todosById.get(list[index - 1] ?? '')?.position
    const after = todosById.get(list[index + 1] ?? '')?.position
    const sectionId = listId === INBOX ? null : listId
    if (
      todo.section_id === sectionId &&
      (before === undefined || before < todo.position) &&
      (after === undefined || after > todo.position)
    ) {
      return
    }
    // The neighbours are open todos; the list's completed ones sit among them
    // unseen, so the new position steps past any in between.
    const done = (doneLists[listId] ?? []).map((id) => todosById.get(id)!.position)
    todosCollection
      .update(todo.id, (d) => {
        d.section_id = sectionId
        d.position = positionBetweenOpen(before, after, done)
      })
      .isPersisted.promise.catch(reportFailure('Move not saved'))
  }

  function dropSection(sectionId: string, finalOrder: string[]) {
    const index = finalOrder.indexOf(sectionId)
    if (index === order.indexOf(sectionId)) return
    const before = sectionsById.get(finalOrder[index - 1] ?? '')?.position
    const after = sectionsById.get(finalOrder[index + 1] ?? '')?.position
    todoSectionsCollection
      .update(sectionId, (draft) => {
        draft.position = positionBetween(before, after)
      })
      .isPersisted.promise.catch(reportFailure('Section order not saved'))
  }

  const listProps = (listId: string): SectionProps => ({
    openIds: derived[listId] ?? [],
    doneIds: doneLists[listId] ?? [],
    todosById,
    collapsed: collapsed.includes(listId),
    onCollapsedChange: (value) => {
      const next = including(collapsed, listId, value)
      setCollapsed(next)
      rememberCollapsed(next)
    },
    showDone: showDone.includes(listId),
    onShowDoneChange: (value) => setShowDone((ids) => including(ids, listId, value)),
  })

  return (
    <DragDropProvider
      sensors={sensors}
      onDragEnd={(event) => {
        const { source, target } = event.operation
        if (!isSortable(source)) return
        // dnd-kit moved nodes while dragging, and a cancel doesn't put back a
        // todo dragged into another section. Remount either way, swapping in
        // fresh DOM before the data change renders.
        flushSync(() => setGeneration((g) => g + 1))
        if (event.canceled) return
        const id = String(source.id)
        if (source.type === 'section') {
          dropSection(id, placeAt(order, id, source.sortable.index))
          return
        }
        // Dropped on a section's list (e.g. an empty one): append. Otherwise
        // dnd-kit has already slotted it among the todos.
        const onList =
          target?.type === 'todo-list' ? String(target.id).replace(/:todos$/, '') : null
        const listId = onList ?? String(source.sortable.group)
        const list = derived[listId]
        if (!list) return
        const index = onList ? list.length : source.sortable.index
        dropTodo(id, withItemAt(derived, listId, id, index))
      }}
    >
      <div key={generation} className="flex flex-col gap-6">
        <Section section={null} {...listProps(INBOX)} />
        {sections.map((section, index) => (
          <SortableSection
            key={section.id}
            index={index}
            section={section}
            {...listProps(section.id)}
          />
        ))}
      </div>
    </DragDropProvider>
  )
}

export function AddSection({ sections }: { sections: TodoSection[] }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const addRef = useRef<HTMLButtonElement>(null)

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) {
      setAdding(false)
      return
    }
    todoSectionsCollection
      .insert({
        id: crypto.randomUUID(),
        owner_id: currentUserId(),
        name: trimmed,
        position: positionAfterLast(sections.map((s) => s.position)),
        created_at: new Date().toISOString(),
      })
      .isPersisted.promise.catch(reportFailure('Section not saved'))
    setName('')
  }

  // Closing from the keyboard hands focus to the Add button that replaces
  // the input; a blur has already put focus where the user wanted it.
  function close() {
    flushSync(() => setAdding(false))
    addRef.current?.focus()
  }

  if (!adding) {
    return (
      <Button
        ref={addRef}
        variant="outline"
        className="h-11 border-dashed bg-transparent"
        onClick={() => setAdding(true)}
      >
        <PlusIcon data-icon="inline-start" />
        Add section
      </Button>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) submit()
        else close()
      }}
    >
      <Input
        autoFocus
        aria-label="Section name"
        placeholder="Section name, Enter to save"
        maxLength={60}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close()
        }}
        onBlur={() => {
          submit()
          setAdding(false)
        }}
      />
    </form>
  )
}
