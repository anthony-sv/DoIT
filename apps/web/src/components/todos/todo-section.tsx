import { type Ref, type RefObject, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useDroppable } from '@dnd-kit/react'
import { useSortable } from '@dnd-kit/react/sortable'
import { CollisionPriority } from '@dnd-kit/abstract'
import { ChevronRightIcon, GripVerticalIcon, PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { todoSectionsCollection, todosCollection } from '@/data/collections'
import type { Todo, TodoSection } from '@/data/schemas'
import { currentUserId } from '@/lib/auth'
import { positionAfterLast } from '@/lib/position'
import { INBOX } from '@/lib/todos'
import { cn } from '@/lib/utils'
import { SectionMenu } from './section-menu'
import { SortableTodo, TodoRow } from './todo-row'

export type SectionProps = {
  openIds: string[]
  doneIds: string[]
  todosById: Map<string, Todo>
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  showDone: boolean
  onShowDoneChange: (show: boolean) => void
}

// Ghost buttons shade while aria-expanded, which suits menus; an open
// section or completed list shouldn't look pressed.
const disclosure = 'aria-expanded:bg-transparent aria-expanded:hover:bg-muted'

function reportFailure(what: string) {
  return (error: Error) => toast.add({ title: what, description: error.message, type: 'error' })
}

export function SortableSection({
  index,
  section,
  ...props
}: SectionProps & { index: number; section: TodoSection }) {
  const { ref, handleRef, isDragging } = useSortable({
    id: section.id,
    index,
    type: 'section',
    accept: 'section',
    collisionPriority: CollisionPriority.Low,
  })
  return (
    <Section ref={ref} handleRef={handleRef} dragging={isDragging} section={section} {...props} />
  )
}

/** The inbox (`section` null) or one of the user's sections. */
export function Section({
  ref,
  handleRef,
  dragging,
  section,
  openIds,
  doneIds,
  todosById,
  collapsed,
  onCollapsedChange,
  showDone,
  onShowDoneChange,
}: SectionProps & {
  ref?: Ref<HTMLElement>
  handleRef?: Ref<HTMLButtonElement>
  dragging?: boolean
  section: TodoSection | null
}) {
  const listId = section?.id ?? INBOX
  const name = section?.name ?? 'Inbox'
  const [renaming, setRenaming] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Todos land here when there is no todo to drop next to.
  const { ref: listRef, isDropTarget } = useDroppable({
    id: `${listId}:todos`,
    type: 'todo-list',
    accept: 'todo',
    collisionPriority: CollisionPriority.Lowest,
  })

  return (
    <section
      ref={ref}
      aria-label={name}
      className={cn('rounded-xl', dragging && 'bg-card shadow-lg ring-2 ring-primary')}
    >
      <Collapsible
        open={!collapsed}
        onOpenChange={(open) => onCollapsedChange(!open)}
        className="flex flex-col gap-1"
      >
        <div className="flex min-h-9 items-center gap-1.5 px-2">
          {handleRef ? (
            <button
              ref={handleRef}
              type="button"
              aria-label={`Move ${name} section`}
              className="cursor-grab rounded text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
            >
              <GripVerticalIcon className="size-4" />
            </button>
          ) : (
            // The inbox always comes first; this keeps its title in line.
            <span className="size-4 shrink-0" />
          )}
          <CollapsibleTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={collapsed ? `Expand ${name}` : `Collapse ${name}`}
                className={disclosure}
              />
            }
          >
            <ChevronRightIcon className="transition-transform group-data-panel-open/button:rotate-90" />
          </CollapsibleTrigger>
          {renaming && section ? (
            <RenameSection
              section={section}
              onDone={() => setRenaming(false)}
              returnFocusTo={headingRef}
            />
          ) : (
            // Out of the tab order; renaming from the keyboard hands focus back here.
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="min-w-0 truncate rounded text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {name}
            </h2>
          )}
          <span className="text-xs text-muted-foreground">{openIds.length}</span>
          <SectionMenu
            className="ml-auto"
            section={section}
            name={name}
            doneIds={doneIds}
            todoCount={openIds.length + doneIds.length}
            onRename={() => setRenaming(true)}
          />
        </div>

        <CollapsibleContent className="flex flex-col gap-1">
          <ul
            ref={listRef}
            className={cn('flex flex-col', isDropTarget && 'rounded-lg bg-accent/50')}
          >
            {openIds.map((id, index) => {
              const todo = todosById.get(id)
              if (!todo) return null
              return <SortableTodo key={id} index={index} listId={listId} todo={todo} />
            })}
            {openIds.length === 0 ? (
              <li className="mx-2 flex min-h-11 items-center justify-center rounded-lg border-[1.5px] border-dashed px-4 text-center text-sm text-muted-foreground">
                Drop todos here or add one below
              </li>
            ) : null}
          </ul>

          <AddTodo sectionId={section?.id ?? null} name={name} />

          {doneIds.length > 0 ? (
            <Collapsible open={showDone} onOpenChange={onShowDoneChange}>
              <CollapsibleTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn('ml-7.5 text-muted-foreground', disclosure)}
                  />
                }
              >
                <ChevronRightIcon
                  data-icon="inline-start"
                  className="transition-transform group-data-panel-open/button:rotate-90"
                />
                {doneIds.length} completed
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="flex flex-col">
                  {doneIds.map((id) => {
                    const todo = todosById.get(id)
                    return todo ? <TodoRow key={id} todo={todo} /> : null
                  })}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    </section>
  )
}

function RenameSection({
  section,
  onDone,
  returnFocusTo,
}: {
  section: TodoSection
  onDone: () => void
  returnFocusTo: RefObject<HTMLElement | null>
}) {
  const [name, setName] = useState(section.name)

  function save() {
    const trimmed = name.trim()
    if (trimmed && trimmed !== section.name) {
      todoSectionsCollection
        .update(section.id, (d) => {
          d.name = trimmed
        })
        .isPersisted.promise.catch(reportFailure('Section not renamed'))
    }
    onDone()
  }

  return (
    <Input
      autoFocus
      aria-label="Section name"
      maxLength={60}
      className="h-7 max-w-64"
      value={name}
      onChange={(e) => setName(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== 'Escape') return
        // Hand focus to the heading, as if the input had never been there.
        flushSync(() => (e.key === 'Enter' ? save() : onDone()))
        returnFocusTo.current?.focus()
      }}
    />
  )
}

function AddTodo({ sectionId, name }: { sectionId: string | null; name: string }) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const addRef = useRef<HTMLButtonElement>(null)

  function add() {
    const trimmed = text.trim()
    if (!trimmed) {
      setAdding(false)
      return
    }
    // Past the completed todos too, so unchecking one never lands on the
    // same spot as the new one.
    const siblings = todosCollection.toArray
      .filter((t) => t.section_id === sectionId)
      .map((t) => t.position)
      .sort((a, b) => a - b)
    todosCollection
      .insert({
        id: crypto.randomUUID(),
        owner_id: currentUserId(),
        section_id: sectionId,
        text: trimmed,
        done: false,
        due_on: null,
        position: positionAfterLast(siblings),
        created_at: new Date().toISOString(),
      })
      .isPersisted.promise.catch(reportFailure('Todo not saved'))
    setText('')
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
        variant="ghost"
        className="ml-7 justify-start text-muted-foreground"
        onClick={() => setAdding(true)}
      >
        <PlusIcon data-icon="inline-start" />
        Add todo
      </Button>
    )
  }

  return (
    <form
      className="mr-2 ml-9"
      onSubmit={(e) => {
        e.preventDefault()
        if (text.trim()) add()
        else close()
      }}
    >
      <Input
        autoFocus
        aria-label={`New todo in ${name}`}
        placeholder="Add a todo, Enter to save"
        maxLength={300}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close()
        }}
        onBlur={() => {
          add()
          setAdding(false)
        }}
      />
    </form>
  )
}
