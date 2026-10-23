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
  uniqueIndex,
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

// Private tables (todos, sections, drawings) belong to one user: one policy
// covers select, insert, update and delete.
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

// Boards are shared through board_members. Everything on a board (columns,
// sprints, labels, cards and their checklists and activity) is open to its
// owner and its members. The functions are SECURITY DEFINER (migration 0004),
// so they read boards and board_members without recursing into these policies.
// owner_id on those rows is always the board's owner, set by triggers.
const boardMembersAll = (table: string, boardId: AnyPgColumn) =>
  pgPolicy(`${table}_member_all`, {
    for: 'all',
    to: authenticatedRole,
    using: sql`public.has_board_access(${boardId})`,
    withCheck: sql`public.has_board_access(${boardId})`,
  })

const cardMembersAll = (table: string, cardId: AnyPgColumn) =>
  pgPolicy(`${table}_member_all`, {
    for: 'all',
    to: authenticatedRole,
    using: sql`public.has_card_access(${cardId})`,
    withCheck: sql`public.has_card_access(${cardId})`,
  })

// Who wrote a card or an activity entry. A trigger sets it on insert, so it
// can't be forged, and keeps it on update. Null once that user is deleted.
const createdBy = () =>
  uuid()
    .default(sql`auth.uid()`)
    .references(() => authUsers.id, { onDelete: 'set null' })

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
    // Members see and edit the board; a trigger keeps its owner, archive state
    // and sidebar position for the owner to change. Only the owner deletes it.
    pgPolicy('boards_select', {
      for: 'select',
      to: authenticatedRole,
      using: sql`public.has_board_access(${t.id})`,
    }),
    pgPolicy('boards_insert', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`${t.ownerId} = (select auth.uid())`,
    }),
    pgPolicy('boards_update', {
      for: 'update',
      to: authenticatedRole,
      using: sql`public.has_board_access(${t.id})`,
      withCheck: sql`public.has_board_access(${t.id})`,
    }),
    pgPolicy('boards_delete', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`${t.ownerId} = (select auth.uid())`,
    }),
  ],
)

// The people a board is shared with, besides its owner. Rows come only from
// invite_board_member() (migration 0006), which only the owner can call. The
// owner removes anyone; a member can remove themselves (leave).
export const boardMembers = pgTable(
  'board_members',
  {
    id: uuid().primaryKey().defaultRandom(),
    boardId: uuid()
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex().on(t.boardId, t.userId),
    index().on(t.userId),
    pgPolicy('board_members_select', {
      for: 'select',
      to: authenticatedRole,
      using: sql`public.has_board_access(${t.boardId})`,
    }),
    pgPolicy('board_members_delete', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`${t.userId} = (select auth.uid()) or public.is_board_owner(${t.boardId})`,
    }),
  ],
)

// The email of everyone you share a board with (and your own), so boards can
// show who's on them and who wrote what. auth.users stays private: a trigger
// on it keeps this copy (migration 0006), and no one writes it directly.
export const profiles = pgTable(
  'profiles',
  {
    id: uuid()
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    email: text().notNull().default(''),
  },
  (t) => [
    pgPolicy('profiles_select', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${t.id} = (select auth.uid()) or public.shares_board_with(${t.id})`,
    }),
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
    boardMembersAll('columns', t.boardId),
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
    boardMembersAll('sprints', t.boardId),
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
    boardMembersAll('labels', t.boardId),
  ],
)

// A user story on a board. Its cards are its tasks; a card in no story is
// board work of its own. Deleting a story keeps its cards, in no story.
export const stories = pgTable(
  'stories',
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: ownerId(),
    boardId: uuid()
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    description: text().notNull().default(''),
    position: doublePrecision().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.boardId), boardMembersAll('stories', t.boardId)],
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
    storyId: uuid().references(() => stories.id, { onDelete: 'set null' }),
    // Who's on it: the board's owner or a member (a trigger checks, and
    // unassigns people who leave the board).
    assigneeId: uuid().references(() => authUsers.id, { onDelete: 'set null' }),
    // Assigned by a trigger from boards.next_number.
    number: integer().notNull().default(0),
    title: text().notNull(),
    description: text().notNull().default(''),
    priority: text().notNull().default('medium'),
    dueOn: date(),
    labelIds: uuid().array().notNull().default(sql`'{}'::uuid[]`),
    // Days of work. Sizes the card's sticky note on the story board.
    estimate: doublePrecision(),
    // A tint from the label palette; null is a plain card.
    color: text(),
    // Order inside its column on the board, and inside the backlog list.
    position: doublePrecision().notNull(),
    backlogPosition: doublePrecision().notNull(),
    completedAt: timestamp({ withTimezone: true }),
    createdBy: createdBy(),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index().on(t.boardId),
    index().on(t.columnId),
    index().on(t.sprintId),
    index().on(t.storyId),
    index().on(t.assigneeId),
    check(
      'cards_priority_check',
      sql`${t.priority} in ('low', 'medium', 'high', 'urgent')`,
    ),
    check(
      'cards_estimate_check',
      sql`${t.estimate} is null or (${t.estimate} >= 0 and ${t.estimate} <= 999)`,
    ),
    colorCheck('cards', t.color),
    boardMembersAll('cards', t.boardId),
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
  (t) => [index().on(t.cardId), cardMembersAll('checklist_items', t.cardId)],
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
    createdBy: createdBy(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.cardId), cardMembersAll('card_events', t.cardId)],
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
    // The card it was imported from (My todos → Import assigned cards). Kept
    // when the card's board is no longer yours; null once the card is deleted.
    cardId: uuid().references(() => cards.id, { onDelete: 'set null' }),
    text: text().notNull(),
    done: boolean().notNull().default(false),
    dueOn: date(),
    position: doublePrecision().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.ownerId),
    index().on(t.sectionId),
    index().on(t.cardId),
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
