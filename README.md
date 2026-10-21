# DoIT

Kanban boards with custom columns, drag and drop, sprints with a burndown,
a personal todo list in sections, and drawings: whiteboards (Excalidraw) and
diagrams (draw.io). React 19 · TanStack Start · TanStack DB · Supabase.

## Set up

1. Create a Supabase project for DoIT.
2. `cp apps/web/.env.example apps/web/.env` and fill in the three values from
   the dashboard (Project Settings → API keys, and Connect → Session pooler).
3. Create the tables, policies and triggers:
   ```sh
   pnpm install
   pnpm --filter web db:migrate
   ```
4. In Supabase → Authentication:
   - URL Configuration → Site URL: `http://localhost:5310` (switch it to the
     production URL when you deploy). Redirect URLs: `http://localhost:5310`
     and `http://localhost:5310/**`.
   - Email Templates → Magic Link and Confirm signup: add `{{ .Token }}` to
     the body so the email shows the code as well as the link. A first
     sign-in creates the account, so it gets the Confirm signup email.
5. `pnpm dev` and open http://localhost:5310.

The first sign-in is by emailed code. Then choose **Set password…** in the
account menu (bottom left) and sign in with email and password from then on;
the code stays as a fallback. Sessions are kept per browser, and signing out
only signs out that browser.

### Optional: GitHub or Google sign-in

1. Create a GitHub OAuth App (GitHub → Settings → Developer settings) with
   the callback URL `https://<project-ref>.supabase.co/auth/v1/callback`.
2. Supabase → Authentication → Sign In / Providers → GitHub: enable it and
   paste the client ID and secret.
3. Add `VITE_AUTH_PROVIDERS=github` to `apps/web/.env` (and to Vercel). The
   login page then shows "Continue with GitHub". If GitHub's verified email
   matches your account's, it signs into the same account.

Google works the same way with `VITE_AUTH_PROVIDERS=github,google`.

## Run it on your own network

Nothing has to leave your machine or company network. DoIT talks to three
outside services, and each can be replaced:

| Service | Default | Local replacement |
| --- | --- | --- |
| Database and auth | Supabase cloud | Supabase on your machine or server |
| Diagram editor | embed.diagrams.net | the `jgraph/drawio` image (`VITE_DRAWIO_URL`) |
| OAuth sign-in | GitHub, Google | leave `VITE_AUTH_PROVIDERS` empty |

Whiteboard fonts are always served by the app itself (`vite.config.ts` copies
them into `public/excalidraw`), so Excalidraw doesn't fetch anything either.

With Docker installed:

1. Start Supabase from `apps/web` (its settings are in `apps/web/supabase`):
   ```sh
   cd apps/web
   npx supabase start
   npx supabase status
   ```
2. Start draw.io: `docker run -d --name drawio -p 8080:8080 jgraph/drawio`.
3. `cp apps/web/.env.example apps/web/.env` and set:
   - `VITE_SUPABASE_URL=http://127.0.0.1:54321`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: the publishable key that
     `supabase status` prints
   - `VITE_DRAWIO_URL=http://localhost:8080`
   - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`
4. `pnpm --filter web db:migrate`, then `pnpm dev`.

Sign-in emails don't go out: open Mailpit at http://127.0.0.1:54324 to read
the code. Supabase Studio is at http://127.0.0.1:54323. `npx supabase stop`
keeps the data; `npx supabase stop --no-backup` deletes it.

For a team, run the same pieces on a company server instead: [self-hosted
Supabase](https://supabase.com/docs/guides/self-hosting/docker) and the draw.io
image, with the URLs above pointing at that server and real SMTP for the
codes. `VITE_` values are inlined at build time, so build after setting them.

## Deploy (Vercel)

1. Vercel → Add New → Project → import this repo.
   - Root Directory: `apps/web` (keep "Include files outside the root
     directory in the Build Step" on: the lockfile lives at the repo root).
   - Framework Preset: TanStack Start (Nitro works too). Leave the build,
     output and install commands alone: Vercel runs the `build` script and
     Nitro writes `.vercel/output`, which Vercel deploys as is.
2. Environment Variables, for Production and Preview:
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, the same values
     as in `apps/web/.env`. They are inlined at build time, so redeploy after
     changing them; the build fails if either is missing.
   - `ENABLE_EXPERIMENTAL_COREPACK=1`, so the build uses the pnpm version in
     `packageManager` (Vercel itself only picks pnpm 9 or 10).
   - `VITE_AUTH_PROVIDERS` if you set up GitHub or Google.
   - Never `DATABASE_URL`: only drizzle-kit uses it, from your machine.
3. Supabase → Authentication → URL Configuration: Site URL is the production
   URL. For sign-in on preview deployments, also allow
   `https://*-<vercel-scope>.vercel.app` and
   `https://*-<vercel-scope>.vercel.app/**`.
4. Pushes to `master` deploy to production; other branches get preview URLs.
   Run `pnpm --filter web db:migrate` before pushing code that needs a new
   migration.

Once your account exists, consider turning off "Allow new users to sign up"
(Authentication → Sign In / Providers). Supabase's built-in email sends only a
couple of emails an hour; set up custom SMTP (for example Resend) if you rely
on codes. Free Supabase projects pause after a week without activity.

## Drawings

Whiteboards use [Excalidraw](https://excalidraw.com). Diagrams use the real
draw.io editor, embedded from embed.diagrams.net or your own draw.io
(`VITE_DRAWIO_URL`); the diagram itself stays in
your browser and in Supabase. Each drawing exports as a PNG, as its native
file (`.excalidraw` or `.drawio`, which open in excalidraw.com and draw.io), or
as a DoIT JSON file, and imports any of the three. tldraw files (`.tldr`)
can't be imported.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on port 5310 |
| `pnpm build` | Production build (Nitro server in `apps/web/.output`) |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript |
| `pnpm --filter web db:generate` | New migration after editing `src/db/schema.ts` |
| `pnpm --filter web db:migrate` | Apply pending migrations |
