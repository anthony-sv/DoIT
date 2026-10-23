// Single-card writes shared by the card sheet, the table and the story board,
// so every view changes a card the same way and toasts the same way when a
// write fails.
import { toast } from '@/components/ui/toast'
import { cardsCollection } from '@/data/collections'
import { assignCard, moveCard } from '@/data/actions'
import type { Card, Column } from '@/data/schemas'
import type { BoardPerson } from '@/hooks/use-board-people'
import { positionAfterLast } from '@/lib/position'

export function reportFailure(what: string) {
  return (error: Error) => toast.add({ title: what, description: error.message, type: 'error' })
}

export function updateCard(id: string, what: string, change: (draft: Card) => void) {
  cardsCollection.update(id, change).isPersisted.promise.catch(reportFailure(what))
}

/** Move a card to the bottom of another column: its Status field. */
export function moveToColumn(card: Card, columns: Column[], toId: string) {
  const from = columns.find((c) => c.id === card.column_id)
  const to = columns.find((c) => c.id === toId)
  if (!from || !to || from.id === to.id) return
  const siblings = cardsCollection.toArray
    .filter((c) => c.column_id === to.id)
    .map((c) => c.position)
    .sort((a, b) => a - b)
  moveCard(card, from, to, positionAfterLast(siblings)).isPersisted.promise.catch(
    reportFailure('Move not saved'),
  )
}

/** Give a card to someone on its board, or (null) to no one. */
export function setAssignee(card: Card, people: BoardPerson[], userId: string | null) {
  if (userId === card.assignee_id) return
  const person = people.find((p) => p.userId === userId)
  if (userId !== null && !person) return
  assignCard(card, person ? { userId: person.userId, email: person.email } : null).isPersisted.promise.catch(
    reportFailure('Assignee not saved'),
  )
}

/** The assignee's email, for a card whose assignee may have left meanwhile. */
export function assigneeEmail(people: BoardPerson[], userId: string) {
  return people.find((p) => p.userId === userId)?.email ?? 'Unknown account'
}
