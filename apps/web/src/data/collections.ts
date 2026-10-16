// One TanStack DB collection per Supabase table. Each loads the signed-in
// user's whole table (row-level security filters it to their rows) and writes
// changes back through supabase-js; the Query adapter refetches after every
// write, so the collection always ends on what Postgres stored.
import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { queryClient } from '@/lib/query-client'
import { supabase } from '@/lib/supabase'
import {
  type Board,
  type Card,
  type CardEvent,
  type ChecklistItem,
  type Column,
  type Label,
  type Sprint,
  type Todo,
  boardSchema,
  cardEventSchema,
  cardSchema,
  checklistItemSchema,
  columnSchema,
  labelSchema,
  sprintSchema,
  todoSchema,
} from './schemas'

// Columns the database fills in; never sent on insert or update.
const serverOwned = ['created_at', 'updated_at', 'number', 'next_number'] as const

function withoutServerOwned(row: object): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...row }
  for (const key of serverOwned) delete copy[key]
  return copy
}

function fail(table: string, action: string, error: { message: string }): never {
  throw new Error(`Could not ${action} ${table}: ${error.message}`)
}

// Load and write handlers for one table, spread into queryCollectionOptions
// next to the table's schema.
function supabaseTable<Row extends { id: string }>(table: string) {
  return {
    id: table,
    queryKey: [table],
    queryClient,
    getKey: (row: Row) => row.id,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const { data, error } = await supabase.from(table).select('*').abortSignal(signal)
      if (error) fail(table, 'load', error)
      return data as Row[]
    },
    onInsert: async ({ transaction }: { transaction: { mutations: Array<{ modified: Row }> } }) => {
      const rows = transaction.mutations.map((m) => withoutServerOwned(m.modified))
      const { error } = await supabase.from(table).insert(rows)
      if (error) fail(table, 'save', error)
    },
    onUpdate: async ({
      transaction,
    }: {
      transaction: { mutations: Array<{ key: string | number; changes: Partial<Row> }> }
    }) => {
      await Promise.all(
        transaction.mutations.map(async (m) => {
          const { error } = await supabase
            .from(table)
            .update(withoutServerOwned(m.changes))
            .eq('id', m.key)
          if (error) fail(table, 'update', error)
        }),
      )
    },
    onDelete: async ({
      transaction,
    }: {
      transaction: { mutations: Array<{ key: string | number }> }
    }) => {
      const ids = transaction.mutations.map((m) => m.key)
      const { error } = await supabase.from(table).delete().in('id', ids)
      if (error) fail(table, 'delete', error)
    },
  }
}

export const boardsCollection = createCollection(
  queryCollectionOptions({ ...supabaseTable<Board>('boards'), schema: boardSchema }),
)
export const columnsCollection = createCollection(
  queryCollectionOptions({ ...supabaseTable<Column>('columns'), schema: columnSchema }),
)
export const sprintsCollection = createCollection(
  queryCollectionOptions({ ...supabaseTable<Sprint>('sprints'), schema: sprintSchema }),
)
export const labelsCollection = createCollection(
  queryCollectionOptions({ ...supabaseTable<Label>('labels'), schema: labelSchema }),
)
export const cardsCollection = createCollection(
  queryCollectionOptions({ ...supabaseTable<Card>('cards'), schema: cardSchema }),
)
export const checklistItemsCollection = createCollection(
  queryCollectionOptions({ ...supabaseTable<ChecklistItem>('checklist_items'), schema: checklistItemSchema }),
)
export const cardEventsCollection = createCollection(
  queryCollectionOptions({ ...supabaseTable<CardEvent>('card_events'), schema: cardEventSchema }),
)
export const todosCollection = createCollection(
  queryCollectionOptions({ ...supabaseTable<Todo>('todos'), schema: todoSchema }),
)

const allCollections = [
  boardsCollection,
  columnsCollection,
  sprintsCollection,
  labelsCollection,
  cardsCollection,
  checklistItemsCollection,
  cardEventsCollection,
  todosCollection,
]

export function preloadAll() {
  return Promise.all(allCollections.map((c) => c.preload()))
}
