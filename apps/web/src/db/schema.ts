// Postgres schema for DoIT, applied to Supabase with drizzle-kit.
// The browser never talks to Postgres directly: it uses supabase-js, and the
// row-level-security policies below are what keep each user's rows private.
import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { authUsers, authenticatedRole } from 'drizzle-orm/supabase'

// Plain auth.uid(): Postgres rejects subqueries in DEFAULT, so drizzle's
// authUid helper (a subquery, meant for policies) can't go here.
const ownerId = () =>
  uuid()
    .notNull()
    .default(sql`auth.uid()`)
    .references(() => authUsers.id, { onDelete: 'cascade' })

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow()

// Every table is private to its owner: one policy covers select, insert,
// update and delete.
const ownerOnly = (table: string, owner: AnyPgColumn) =>
  pgPolicy(`${table}_owner_all`, {
    for: 'all',
    to: authenticatedRole,
    using: sql`${owner} = (select auth.uid())`,
    withCheck: sql`${owner} = (select auth.uid())`,
  })

export const labelColors = [
  'blue',
  'purple',
  'teal',
  'red',
  'amber',
  'green',
  'gray',
] as const

const colorCheck = (table: string, column: AnyPgColumn) =>
  check(
    `${table}_color_check`,
    sql`${column} in (${sql.raw(labelColors.map((c) => `'${c}'`).join(', '))})`,
  )

export const boards = pgTable(
  'boards',
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: ownerId(),
    name: text().notNull(),
    // Short prefix for card numbers, e.g. "DSC" → DSC-14.
    key: text().notNull(),
    color: text().notNull().default('blue'),
    position: doublePrecision().notNull(),
    nextNumber: integer().notNull().default(1),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.ownerId),
    colorCheck('boards', t.color),
    ownerOnly('boards', t.ownerId),
  ],
)

export const columns = pgTable(
  'columns',
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: ownerId(),
    boardId: uuid()
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    color: text().notNull().default('gray'),
    position: doublePrecision().notNull(),
    wipLimit: integer(),
    // Cards that land here count as finished for sprint progress.
    isDone: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.boardId),
    colorCheck('columns', t.color),
    check('columns_wip_limit_check', sql`${t.wipLimit} is null or ${t.wipLimit} > 0`),
    ownerOnly('columns', t.ownerId),
  ],
)

export const sprints = pgTable(
  'sprints',
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: ownerId(),
    boardId: uuid()
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    goal: text().notNull().default(''),
    startsOn: date().notNull(),
    endsOn: date().notNull(),
    state: text().notNull().default('planned'),
    closedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.boardId),
    check('sprints_state_check', sql`${t.state} in ('planned', 'active', 'closed')`),
    check('sprints_dates_check', sql`${t.endsOn} >= ${t.startsOn}`),
    ownerOnly('sprints', t.ownerId),
  ],
)

export const labels = pgTable(
  'labels',
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: ownerId(),
    boardId: uuid()
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    color: text().notNull().default('gray'),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.boardId),
    colorCheck('labels', t.color),
    ownerOnly('labels', t.ownerId),
  ],
)

export const cards = pgTable(
  'cards',
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: ownerId(),
    boardId: uuid()
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    columnId: uuid()
      .notNull()
      .references(() => columns.id, { onDelete: 'cascade' }),
    sprintId: uuid().references(() => sprints.id, { onDelete: 'set null' }),
    // Assigned by a trigger from boards.next_number.
    number: integer().notNull().default(0),
    title: text().notNull(),
    description: text().notNull().default(''),
    priority: text().notNull().default('medium'),
    dueOn: date(),
    labelIds: uuid().array().notNull().default(sql`'{}'::uuid[]`),
    // Order inside its column on the board, and inside the backlog list.
    position: doublePrecision().notNull(),
    backlogPosition: doublePrecision().notNull(),
    completedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index().on(t.boardId),
    index().on(t.columnId),
    index().on(t.sprintId),
    check(
      'cards_priority_check',
      sql`${t.priority} in ('low', 'medium', 'high', 'urgent')`,
    ),
    ownerOnly('cards', t.ownerId),
  ],
)

export const checklistItems = pgTable(
  'checklist_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: ownerId(),
    cardId: uuid()
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    text: text().notNull(),
    done: boolean().notNull().default(false),
    position: doublePrecision().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.cardId), ownerOnly('checklist_items', t.ownerId)],
)

export const cardEvents = pgTable(
  'card_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: ownerId(),
    cardId: uuid()
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    // 'created' | 'moved' | 'comment' | 'sprint' — free text on purpose, the
    // UI ignores kinds it does not know.
    kind: text().notNull(),
    body: text().notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.cardId), ownerOnly('card_events', t.ownerId)],
)

export const todoSections = pgTable(
  'todo_sections',
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: ownerId(),
    name: text().notNull(),
    position: doublePrecision().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.ownerId), ownerOnly('todo_sections', t.ownerId)],
)

export const todos = pgTable(
  'todos',
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: ownerId(),
    // No section means the inbox. Deleting a section moves its todos there.
    sectionId: uuid().references(() => todoSections.id, { onDelete: 'set null' }),
    text: text().notNull(),
    done: boolean().notNull().default(false),
    dueOn: date(),
    position: doublePrecision().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.ownerId),
    index().on(t.sectionId),
    ownerOnly('todos', t.ownerId),
  ],
)

export const canvasKinds = ['whiteboard', 'diagram'] as const

export const canvases = pgTable(
  'canvases',
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: ownerId(),
    name: text().notNull(),
    // 'whiteboard' holds an Excalidraw scene, 'diagram' a draw.io file.
    kind: text().notNull(),
    position: doublePrecision().notNull(),
    // The drawing itself. Collections leave it out; the editor loads it.
    data: jsonb().notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index().on(t.ownerId),
    check(
      'canvases_kind_check',
      sql`${t.kind} in (${sql.raw(canvasKinds.map((k) => `'${k}'`).join(', '))})`,
    ),
    ownerOnly('canvases', t.ownerId),
  ],
)
