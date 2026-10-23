import { useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { reportFailure } from '@/components/card/card-writes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { storiesCollection } from '@/data/collections'
import type { Board, Story } from '@/data/schemas'
import { currentUserId } from '@/lib/auth'
import { positionAfterLast } from '@/lib/position'
import { cn } from '@/lib/utils'

/**
 * A button that turns into a title input; Enter adds a story below the
 * others. `adding` lives with the caller, so the input stays open when the
 * first story replaces the empty state with the lanes.
 */
export function NewStory({
  board,
  stories,
  adding,
  onAddingChange,
  inEmpty,
}: {
  board: Board
  /** The board's stories, in order. */
  stories: Story[]
  adding: boolean
  onAddingChange: (adding: boolean) => void
  /** Drawn inside the empty state rather than below the lanes. */
  inEmpty?: boolean
}) {
  const [title, setTitle] = useState('')

  function submit() {
    const trimmed = title.trim()
    if (!trimmed) return
    storiesCollection
      .insert({
        id: crypto.randomUUID(),
        owner_id: currentUserId(),
        board_id: board.id,
        title: trimmed,
        description: '',
        position: positionAfterLast(stories.map((s) => s.position)),
        created_at: new Date().toISOString(),
      })
      .isPersisted.promise.catch(reportFailure('Story not saved'))
    setTitle('')
  }

  if (!adding) {
    return inEmpty ? (
      <Button onClick={() => onAddingChange(true)}>
        <PlusIcon data-icon="inline-start" />
        New story
      </Button>
    ) : (
      <Button
        variant="outline"
        className="h-12 w-60 border-dashed bg-transparent"
        onClick={() => onAddingChange(true)}
      >
        <PlusIcon data-icon="inline-start" />
        New story
      </Button>
    )
  }

  return (
    <form
      className={cn('flex flex-col gap-2', inEmpty ? 'w-full' : 'w-60 rounded-xl bg-column p-2.5')}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Input
        autoFocus
        maxLength={200}
        aria-label="Story title"
        placeholder="Story title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onAddingChange(false)
        }}
        // Only closes: the first story unmounts the empty state's input, and
        // a blur fired on its way out must not add the story twice.
        onBlur={() => {
          if (!title.trim()) onAddingChange(false)
        }}
      />
    </form>
  )
}
