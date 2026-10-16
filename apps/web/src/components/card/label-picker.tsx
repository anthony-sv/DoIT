import { useState } from 'react'
import { CheckIcon, PlusIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from '@/components/ui/toast'
import { cardsCollection, labelsCollection } from '@/data/collections'
import { type Card, type Label, type LabelColor, labelColors } from '@/data/schemas'
import { currentUserId } from '@/lib/auth'
import { colorClasses } from '@/lib/colors'
import { cn } from '@/lib/utils'

function reportFailure(what: string) {
  return (error: Error) => toast.add({ title: what, description: error.message, type: 'error' })
}

export function LabelPicker({
  card,
  boardId,
  labels,
}: {
  card: Card
  boardId: string
  labels: Label[]
}) {
  const [query, setQuery] = useState('')
  const selected = new Set(card.label_ids)
  const trimmed = query.trim()
  const exists = labels.some((l) => l.name.toLowerCase() === trimmed.toLowerCase())

  function toggle(id: string) {
    cardsCollection
      .update(card.id, (d) => {
        d.label_ids = d.label_ids.includes(id)
          ? d.label_ids.filter((l) => l !== id)
          : [...d.label_ids, id]
      })
      .isPersisted.promise.catch(reportFailure('Labels not saved'))
  }

  function create() {
    // New labels cycle through the palette so neighbours differ.
    const color: LabelColor = labelColors[labels.length % labelColors.length]!
    const label: Label = {
      id: crypto.randomUUID(),
      owner_id: currentUserId(),
      board_id: boardId,
      name: trimmed,
      color,
      created_at: new Date().toISOString(),
    }
    // The card can only point at the label once the label row exists.
    labelsCollection
      .insert(label)
      .isPersisted.promise.then(() => toggle(label.id), reportFailure('Label not saved'))
    setQuery('')
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {labels
        .filter((l) => selected.has(l.id))
        .map((l) => (
          <Badge key={l.id} variant="secondary" className={colorClasses[l.color].chip}>
            {l.name}
          </Badge>
        ))}
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size={selected.size > 0 ? 'icon-xs' : 'sm'}
              aria-label="Edit labels"
              className={cn(selected.size > 0 && 'rounded-full border-dashed')}
            />
          }
        >
          <PlusIcon data-icon={selected.size > 0 ? undefined : 'inline-start'} />
          {selected.size > 0 ? null : 'Add label'}
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Find or create a label"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>No labels yet.</CommandEmpty>
              <CommandGroup>
                {labels.map((l) => (
                  <CommandItem key={l.id} value={l.name} onSelect={() => toggle(l.id)}>
                    <span className={cn('size-2.5 rounded-full', colorClasses[l.color].dot)} />
                    {l.name}
                    {selected.has(l.id) ? <CheckIcon className="ml-auto" /> : null}
                  </CommandItem>
                ))}
                {trimmed && !exists ? (
                  <CommandItem value={`create ${trimmed}`} onSelect={create}>
                    <PlusIcon />
                    Create “{trimmed}”
                  </CommandItem>
                ) : null}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
