# DoIT

Kanban boards, sprints, personal todos (in sections) and drawings. One app
today: `apps/web` (pnpm workspace, `apps/*`).

## Commands (from the repo root)

- `pnpm dev`: web app on http://localhost:5310
- `pnpm build` / `pnpm lint` / `pnpm test` / `pnpm typecheck`
- `pnpm --filter web db:generate`: new migration from `src/db/schema.ts`
- `pnpm --filter web db:migrate`: apply migrations (needs `DATABASE_URL`)

## Skills: read them before writing code

The stack ships its own agent skills. They match the installed versions, so
they win over memory and over other projects' code:

- TanStack: `node_modules/@tanstack/*/skills/**/SKILL.md` (start-core,
  react-start, router-core/*, router-plugin, db-core/*, react-db,
  meta-framework, charts/*, markdown/*). List them with
  `find node_modules/.pnpm -maxdepth 8 -name SKILL.md -path '*@tanstack*'`.
- shadcn: `.claude/skills/shadcn` (semantic tokens, `gap-*` not `space-*`,
  `render` not `asChild` because the base is Base UI, Field/FieldGroup forms).
- Charts: also follow the dataviz skill (validate colors, legend + text
  equivalent).

## Architecture

- **TanStack Start, client-only.** `src/start.ts` sets `defaultSsr: false`
  because TanStack DB collections can't run on the server. Nitro still builds
  a server, so server functions can be added later without SSR.
- **Data**: one TanStack DB Query collection per table
  (`src/data/collections.ts`). Each loads the user's whole table through
  supabase-js, in pages by id (PostgREST silently caps a response at Max
  Rows, 1,000 by default), and writes back through it, then refetches the
  table (handlers return `{ refetch: false }`; the adapter's own refetch is
  deprecated).
  `autoIndex: 'eager'` indexes what queries filter, sort and join on; without
  it dev builds warn on every mount. `_app.tsx` preloads them all. Writes that
  span tables or need ordering (board + its columns, closing a sprint,
  deleting a board, sprint, label, column or todo section) are
  `createOptimisticAction`s in
  `src/data/actions.ts`; they must refetch every table they touched.
- **Drawings** (`canvases`): the collection leaves out `data`; the editor
  page (`src/routes/_app/c/$canvasId.tsx`) reads and writes it itself.
  Whiteboards are Excalidraw (pinned, lazy-loaded behind an
  `import.meta.env.SSR` guard so the server bundle stays small), diagrams
  are draw.io embedded from embed.diagrams.net (`referrerPolicy="no-referrer"`,
  or it answers 403 on localhost ports) or from `VITE_DRAWIO_URL`.
  Excalidraw's fonts are copied into `public/excalidraw` by `vite.config.ts`
  and served by the app, never fetched from esm.sh.
- **Local mode**: `apps/web/supabase` configures `npx supabase start` (local
  Supabase in Docker); README "Run it on your own network" has the steps.
- **Security lives in Postgres**, not in route guards (`src/db/schema.ts`).
  Todos, sections and drawings have owner-only RLS policies. Boards are
  shared per board through `board_members` (owner + members, no roles):
  every board table's policy calls `has_board_access()` /
  `has_card_access()` (SECURITY DEFINER, `drizzle/0004_sharing_functions.sql`).
  Triggers (`0001`, `0003`, `0007_sharing_triggers.sql`) check that rows
  point at a board/card/section the caller can open (foreign keys skip RLS),
  set `owner_id` on board rows to the board's owner and `created_by` to the
  writer, keep archiving/position/deleting for the owner, assign card
  numbers, and strip deleted labels off cards. Sharing goes through the
  `invite_board_member()` RPC; `profiles` mirrors auth.users emails for
  people who share a board. `0009` adds: a card's story must be on its
  board and its assignee must be the owner or a member; leaving a board
  unassigns you from its cards; a todo can only link (`card_id`) to a card
  its owner can open. `src/db/policies.test.ts` runs every migration
  in PGlite and checks all of this as different users: extend it with any
  policy or trigger change.
- **Live updates**: `src/data/realtime.ts` subscribes to Supabase Realtime
  for the board tables and refetches the affected collections.
- **Rows are snake_case with ISO-string dates**, exactly as Supabase returns
  them (`src/data/schemas.ts`). No mapping layer.
- **Ordering** uses fractional positions (`src/lib/position.ts`): a drop
  writes one row. Cards have `position` (in a board column) and
  `backlog_position` (backlog and sprint lists).
- **Board views**: the board page's `view` search param picks Board, Table
  or Stories; all three take `BoardViewProps` (`components/board/view-props.ts`)
  from the page, which applies the sprint and text filters once. Card fields
  are edited through `components/card/card-fields.tsx` and written through
  `card-writes.ts`, so every view writes a card the same way.
- **Drag and drop**: `@dnd-kit/react`. Lists render a local copy while
  dragging and write the result on drop. Space picks up with the keyboard;
  Enter opens a card.

## Conventions

- `src/routeTree.gen.ts` is generated by the router plugin. Commit it, never
  edit it.
- `src/components/ui/` is vendored shadcn output; change it only through
  the shadcn CLI. When the CLI can't reach the registry (blocked network),
  install the component by hand from its registry source for this project's
  style (`base-nova`: the base component with its `cn-*` placeholders
  resolved from the style's CSS, `"use client"` dropped). Never stand in
  hand-rolled markup for a shadcn component.
- Colors: theme tokens in `src/styles.css` (light and dark). Label colors
  are the fixed set in `labelColors`, mapped to classes in `src/lib/colors.ts`.
- Every write shows a toast when it fails (`isPersisted.promise.catch`).
