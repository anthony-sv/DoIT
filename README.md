# DoIT

Kanban boards with custom columns, drag and drop, sprints with a burndown,
and a personal todo list. React 19 · TanStack Start · TanStack DB · Supabase.

## Set up

1. Create a Supabase project for DoIT.
2. `cp apps/web/.env.example apps/web/.env` and fill in the three values from
   the dashboard (Project Settings → API keys, and Connect → Session pooler).
3. Create the tables, policies and triggers:
   ```sh
   pnpm install
   pnpm --filter web db:migrate
   ```
4. Sign-in is by emailed code. In Supabase → Authentication:
   - URL Configuration → Site URL: `http://localhost:5310` (plus your
     deployed URL later).
   - Email Templates → Magic Link: add `{{ .Token }}` to the body so the
     email shows the code as well as the link.
5. `pnpm dev` and open http://localhost:5310.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on port 5310 |
| `pnpm build` | Production build (Nitro server in `apps/web/.output`) |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript |
| `pnpm --filter web db:generate` | New migration after editing `src/db/schema.ts` |
| `pnpm --filter web db:migrate` | Apply pending migrations |
