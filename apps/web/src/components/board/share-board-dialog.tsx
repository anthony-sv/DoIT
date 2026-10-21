import { useState } from 'react'
import { UsersIcon, XIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { inviteMember, removeMember } from '@/data/actions'
import type { Board } from '@/data/schemas'
import { type BoardPerson, useBoardPeople } from '@/hooks/use-board-people'
import { currentUserId } from '@/lib/auth'

/**
 * Who a board is shared with. The owner adds people by email and removes
 * them; members see the list. Postgres enforces both (see migration 0007).
 */
export function ShareBoardDialog({
  board,
  open,
  onOpenChange,
}: {
  board: Board
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const people = useBoardPeople(board)
  const isOwner = board.owner_id === currentUserId()
  const owner = people[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share {board.name}</DialogTitle>
          <DialogDescription>
            {isOwner
              ? 'People you add can see and change everything on this board. Only you can share, archive or delete it.'
              : `Everyone here can see and change everything on this board. Only ${owner.email} can share, archive or delete it.`}
          </DialogDescription>
        </DialogHeader>
        {/* Mounts with each opening, so the email starts empty. */}
        {isOwner && open ? <InviteForm board={board} /> : null}
        <Separator />
        <ul className="flex flex-col gap-3" aria-label="People on this board">
          {people.map((person) => (
            <PersonRow key={person.userId} person={person} canRemove={isOwner && !person.isOwner} />
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

function InviteForm({ board }: { board: Board }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit() {
    if (!/^\S+@\S+$/.test(email.trim())) {
      setError('Enter an email address.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await inviteMember(board, email)
      setEmail('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="share-email">Add by email</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="share-email"
            type="email"
            autoComplete="off"
            placeholder="teammate@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'share-email-error' : undefined}
          />
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Share
          </Button>
        </div>
        <FieldError id="share-email-error">{error}</FieldError>
      </Field>
    </form>
  )
}

function PersonRow({ person, canRemove }: { person: BoardPerson; canRemove: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <Avatar size="sm">
        <AvatarFallback className="uppercase">{person.email.slice(0, 2)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate text-sm">
        {person.email}
        {person.isYou ? <span className="text-muted-foreground"> (you)</span> : null}
      </span>
      {person.isOwner ? <Badge variant="secondary">Owner</Badge> : null}
      {canRemove && person.member ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${person.email}`}
          onClick={() =>
            removeMember(person.member!).isPersisted.promise.catch((error: Error) =>
              toast.add({ title: 'Not removed', description: error.message, type: 'error' }),
            )
          }
        >
          <XIcon />
        </Button>
      ) : null}
    </li>
  )
}

/** The board header's Share button: everyone on the board, then the label. */
export function ShareBoardButton({ board }: { board: Board }) {
  const [open, setOpen] = useState(false)
  const people = useBoardPeople(board)
  const shown = people.slice(0, 3)

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {people.length > 1 ? (
          <AvatarGroup data-icon="inline-start" aria-hidden>
            {shown.map((person) => (
              <Avatar key={person.userId} size="sm">
                <AvatarFallback className="uppercase">{person.email.slice(0, 2)}</AvatarFallback>
              </Avatar>
            ))}
            {people.length > shown.length ? (
              <AvatarGroupCount>+{people.length - shown.length}</AvatarGroupCount>
            ) : null}
          </AvatarGroup>
        ) : (
          <UsersIcon data-icon="inline-start" />
        )}
        Share
        {people.length > 1 ? <span className="sr-only"> ({people.length} people)</span> : null}
      </Button>
      <ShareBoardDialog board={board} open={open} onOpenChange={setOpen} />
    </>
  )
}
