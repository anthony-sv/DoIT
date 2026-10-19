// One TanStack DB collection per Supabase table. Each loads the signed-in
// user's whole table in pages (row-level security filters it to their rows)
// and writes changes back through supabase-js, then refetches the table, so
// the collection always ends on what Postgres stored.
import { BasicIndex, createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { queryClient } from '@/lib/query-client'
import { supabase } from '@/lib/supabase'
import {
  type Board,
  type Canvas,
  type Card,
  type CardEvent,
  type ChecklistItem,
  type Column,
  type Label,
  type Sprint,
  type Todo,
  type TodoSection,
  boardSchema,
  canvasSchema,
  cardEventSchema,
  cardSchema,
  checklistItemSchema,
  columnSchema,
  labelSchema,
  sprintSchema,
  todoSchema,
  todoSectionSchema,
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

type Refetchable = { utils: { refetch: () => Promise<unknown> } }

// Handlers refetch themselves and opt out of the adapter's automatic refetch,
// which query-db-collection has deprecated (it warns once per page load).
// The write still settles only after the fresh rows are in.
async function refetched(collection: Refetchable) {
  await collection.utils.refetch()
  return { refetch: false } as const
}

// PostgREST returns at most the project's Max Rows (1,000 by default) per
// request, without an error, and the collection treats each result as the
// whole table. So the loader reads in pages, each starting after the last id
// (with offsets, a delete mid-load would make a row slip between pages). A
// short page ends the load, so keep this at or below Max Rows.
const pageSize = 1000

// Load and write handlers for one table, spread into queryCollectionOptions
// next to the table's schema. `columns` leaves out what the list never needs.
function supabaseTable<Row extends { id: string }>(table: string, columns = '*') {
  return {
    id: table,
    queryKey: [table],
    queryClient,
    getKey: (row: Row) => row.id,
    // Index every field a live query filters, sorts or joins on. Without it
    // each query scans the table, and development builds warn about it.
    autoIndex: 'eager' as const,
    defaultIndexType: BasicIndex,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const rows: Row[] = []
      for (;;) {
        let request = supabase.from(table).select(columns)
        const last = rows.at(-1)
        if (last) request = request.gt('id', last.id)
        const { data, error } = await request.order('id').limit(pageSize).abortSignal(signal)
        if (error) fail(table, 'load', error)
        // supabase-js can't type a column list that isn't a literal.
        const page = data as unknown as Row[]
        rows.push(...page)
        if (page.length < pageSize) return rows
      }
    },
    onInsert: async ({
      transaction,
      collection,
    }: {
      transaction: { mutations: Array<{ modified: Row }> }
      collection: Refetchable
    }) => {
      const rows = transaction.mutations.map((m) => withoutServerOwned(m.modified))
      const { error } = await supabase.from(table).insert(rows)
      if (error) fail(table, 'save', error)
      return refetched(collection)
    },
    onUpdate: async ({
      transaction,
      collection,
    }: {
      transaction: { mutations: Array<{ key: string | number; changes: Partial<Row> }> }
      collection: Refetchable
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
      return refetched(collection)
    },
    onDelete: async ({
      transaction,
      collection,
    }: {
      transaction: { mutations: Array<{ key: string | number }> }
      collection: Refetchable
    }) => {
      const ids = transaction.mutations.map((m) => m.key)
      const { error } = await supabase.from(table).delete().in('id', ids)
      if (error) fail(table, 'delete', error)
      return refetched(collection)
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
export const todoSectionsCollection = createCollection(
  queryCollectionOptions({
    ...supabaseTable<TodoSection>('todo_sections'),
    schema: todoSectionSchema,
  }),
)
// Everything but `data`: drawings can be large, so the editor loads one at a
// time (src/components/canvas).
export const canvasesCollection = createCollection(
  queryCollectionOptions({
    ...supabaseTable<Canvas>(
      'canvases',
      'id, owner_id, name, kind, position, created_at, updated_at',
    ),
    schema: canvasSchema,
  }),
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
  todoSectionsCollection,
  canvasesCollection,
]

export function preloadAll() {
  return Promise.all(allCollections.map((c) => c.preload()))
}
