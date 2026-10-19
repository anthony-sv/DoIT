import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/ui/toast'
import { todosCollection } from '@/data/collections'
import type { Todo } from '@/data/schemas'

function reportFailure(what: string) {
  return (error: Error) => toast.add({ title: what, description: error.message, type: 'error' })
}

/** Sets or clears a todo's due date. The row shows the date itself. */
export function TodoDuePicker({ todo, className }: { todo: Todo; className?: string }) {
  const [open, setOpen] = useState(false)
  const selected = todo.due_on ? parseISO(todo.due_on) : undefined

  function setDue(dueOn: string | null) {
    setOpen(false)
    if (dueOn === todo.due_on) return
    todosCollection
      .update(todo.id, (d) => {
        d.due_on = dueOn
      })
      .isPersisted.promise.catch(reportFailure('Due date not saved'))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Due date for “${todo.text}”`}
            className={className}
          />
        }
      >
        <CalendarIcon />
      </PopoverTrigger>
      <PopoverContent className="w-auto gap-0 p-0" align="end">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => setDue(date ? format(date, 'yyyy-MM-dd') : null)}
        />
        {todo.due_on ? (
          <>
            <Separator />
            <div className="p-1">
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setDue(null)}>
                <XIcon data-icon="inline-start" />
                Clear due date
              </Button>
            </div>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
