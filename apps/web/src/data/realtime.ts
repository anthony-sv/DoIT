// Live updates for shared boards. Supabase Realtime reports every change to
// the board tables that this user's policies let them read (their own writes
// too); each one refetches the collections it affects, a beat later so a burst
// of changes (a sprint closing, a column deleted) costs one load per table.
// The events only say "something changed": the refetch reads what Postgres
// holds, through the same policies as every other load.
import {
  boardMembersCollection,
  boardsCollection,
  cardEventsCollection,
  cardsCollection,
  checklistItemsCollection,
  columnsCollection,
  labelsCollection,
  profilesCollection,
  sprintsCollection,
  storiesCollection,
} from './collections'
import { supabase } from '@/lib/supabase'

type Refetchable = { utils: { refetch: () => Promise<unknown> } }

const boardTables = {
  boards: [boardsCollection],
  columns: [columnsCollection],
  sprints: [sprintsCollection],
  labels: [labelsCollection],
  stories: [storiesCollection],
  cards: [cardsCollection],
  checklist_items: [checklistItemsCollection],
  card_events: [cardEventsCollection],
} satisfies Record<string, Refetchable[]>

// Being added to or removed from a board changes which rows of every board
// table this user can read, and whose emails.
const everything: Refetchable[] = [
  ...Object.values(boardTables).flat(),
  boardMembersCollection,
  profilesCollection,
]

const delayMs = 300

/** Subscribes to changes on shared boards. Returns the unsubscribe. */
export function subscribeToBoardChanges() {
  const pending = new Map<Refetchable, ReturnType<typeof setTimeout>>()
  const refetchSoon = (collections: Refetchable[]) => {
    for (const collection of collections) {
      clearTimeout(pending.get(collection))
      pending.set(
        collection,
        setTimeout(() => {
          pending.delete(collection)
          // A failed load keeps the rows already shown; the next change retries.
          collection.utils.refetch().catch(() => {})
        }, delayMs),
      )
    }
  }

  let channel = supabase.channel('board-changes')
  for (const [table, collections] of Object.entries(boardTables)) {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () =>
      refetchSoon(collections),
    )
  }
  channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'board_members' }, () =>
    refetchSoon(everything),
  )

  // The first subscribe follows the preload. A later one is a reconnect, and
  // changes made while offline sent no events, so reload everything then.
  let connected = false
  channel.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return
    if (connected) refetchSoon(everything)
    connected = true
  })

  return () => {
    for (const timer of pending.values()) clearTimeout(timer)
    void supabase.removeChannel(channel)
  }
}
