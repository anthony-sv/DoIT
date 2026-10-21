// The row-level security and triggers that keep boards private and make
// sharing work, run against the real migrations in PGlite (Postgres in WASM).
// Supabase's auth schema, roles and default grants are stubbed just enough.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

const drizzleDir = join(import.meta.dirname, '../../drizzle')

const alice = '00000000-0000-4000-8000-00000000000a'
const bob = '00000000-0000-4000-8000-00000000000b'
const carol = '00000000-0000-4000-8000-00000000000c'

let db: PGlite

async function migrate() {
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
      AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
    INSERT INTO auth.users VALUES
      ('${alice}', 'alice@example.com'), ('${bob}', 'bob@example.com');
  `)
  const journal = JSON.parse(readFileSync(join(drizzleDir, 'meta/_journal.json'), 'utf8')) as {
    entries: Array<{ tag: string }>
  }
  for (const { tag } of journal.entries) {
    const sql = readFileSync(join(drizzleDir, `${tag}.sql`), 'utf8')
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) await db.exec(statement)
    }
  }
  // Signs up after the migrations: the trigger fills in their profile.
  await db.exec(`INSERT INTO auth.users VALUES ('${carol}', 'carol@example.com')`)
}

/** Runs `sql` as the signed-in `user`, like a request through PostgREST. */
async function as<T = Record<string, unknown>>(user: string, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [user])
    await tx.exec('SET LOCAL ROLE authenticated')
    return (await tx.query<T>(sql, params)).rows
  })
}

const ids = {
  board: '10000000-0000-4000-8000-000000000001',
  column: '20000000-0000-4000-8000-000000000001',
  card: '30000000-0000-4000-8000-000000000001',
  bobBoard: '10000000-0000-4000-8000-000000000002',
  bobColumn: '20000000-0000-4000-8000-000000000002',
}

async function addCard(user: string, id: string, columnId = ids.column, boardId = ids.board) {
  await as(
    user,
    `INSERT INTO cards (id, owner_id, board_id, column_id, title, position, backlog_position)
     VALUES ($1, $2, $3, $4, 'A card', 1, 1)`,
    [id, user, boardId, columnId],
  )
}

beforeAll(async () => {
  db = new PGlite()
  await migrate()
  await as(alice, `INSERT INTO boards (id, name, key, position) VALUES ('${ids.board}', 'Team', 'TM', 1)`)
  await as(alice, `INSERT INTO columns (id, board_id, name, position) VALUES ('${ids.column}', '${ids.board}', 'To do', 1)`)
  await addCard(alice, ids.card)
  await as(bob, `INSERT INTO boards (id, name, key, position) VALUES ('${ids.bobBoard}', 'Mine', 'MN', 1)`)
  await as(bob, `INSERT INTO columns (id, board_id, name, position) VALUES ('${ids.bobColumn}', '${ids.bobBoard}', 'To do', 1)`)
}, 60_000)

describe('board sharing', () => {
  it('keeps a board private until it is shared', async () => {
    expect(await as(bob, 'SELECT id FROM boards')).toEqual([{ id: ids.bobBoard }])
    expect(await as(bob, 'SELECT id FROM cards')).toEqual([])
    await expect(addCard(bob, crypto.randomUUID())).rejects.toThrow()
  })

  it('lets only the owner share, and only with an existing account', async () => {
    await expect(
      as(bob, `SELECT invite_board_member('${ids.board}', 'bob@example.com')`),
    ).rejects.toThrow(/Only the board's owner/)
    await expect(
      as(alice, `SELECT invite_board_member('${ids.board}', 'nobody@example.com')`),
    ).rejects.toThrow(/No one has signed in/)
    await expect(
      as(bob, `INSERT INTO board_members (board_id, user_id) VALUES ('${ids.board}', '${bob}')`),
    ).rejects.toThrow()

    await as(alice, `SELECT invite_board_member('${ids.board}', ' Bob@Example.com ')`)
    // A second invite is a no-op.
    await as(alice, `SELECT invite_board_member('${ids.board}', 'bob@example.com')`)
    expect(await as(alice, 'SELECT user_id FROM board_members')).toEqual([{ user_id: bob }])
  })

  it('opens everything on the board to a member', async () => {
    expect(await as(bob, 'SELECT id FROM boards ORDER BY id')).toEqual([
      { id: ids.board },
      { id: ids.bobBoard },
    ])
    expect(await as(bob, 'SELECT id FROM cards')).toEqual([{ id: ids.card }])
  })

  it("files a member's rows under the board's owner, written by the member", async () => {
    const card = crypto.randomUUID()
    await addCard(bob, card)
    await as(bob, `INSERT INTO card_events (card_id, kind, body, created_by) VALUES ($1, 'comment', 'Hi', $2)`, [
      card,
      alice, // a forged author is ignored
    ])
    await as(bob, `INSERT INTO checklist_items (card_id, text, position) VALUES ($1, 'Step', 1)`, [card])
    expect(await as(alice, 'SELECT owner_id, created_by, number FROM cards WHERE id = $1', [card])).toEqual([
      { owner_id: alice, created_by: bob, number: 2 },
    ])
    expect(await as(alice, 'SELECT owner_id, created_by FROM card_events WHERE card_id = $1', [card])).toEqual([
      { owner_id: alice, created_by: bob },
    ])
    expect(await as(alice, 'SELECT owner_id FROM checklist_items')).toEqual([{ owner_id: alice }])
    // Nor can an update change the author.
    await as(alice, 'UPDATE cards SET created_by = $1 WHERE id = $2', [alice, card])
    expect(await as(bob, 'SELECT created_by FROM cards WHERE id = $1', [card])).toEqual([{ created_by: bob }])
  })

  it("won't let a card point at another board's column", async () => {
    await expect(addCard(bob, crypto.randomUUID(), ids.bobColumn, ids.board)).rejects.toThrow(
      /column does not belong/,
    )
    await expect(as(bob, 'UPDATE cards SET column_id = $1 WHERE id = $2', [ids.bobColumn, ids.card])).rejects.toThrow(
      /column does not belong/,
    )
  })

  it('lets a member rename the board but not archive, move, take over or delete it', async () => {
    await as(bob, `UPDATE boards SET name = 'Team board' WHERE id = '${ids.board}'`)
    await expect(as(bob, `UPDATE boards SET archived_at = now() WHERE id = '${ids.board}'`)).rejects.toThrow(
      /only the board's owner/,
    )
    await expect(as(bob, `UPDATE boards SET position = 5 WHERE id = '${ids.board}'`)).rejects.toThrow()
    await expect(as(bob, `UPDATE boards SET owner_id = '${bob}' WHERE id = '${ids.board}'`)).rejects.toThrow()
    await as(bob, `DELETE FROM boards WHERE id = '${ids.board}'`)
    expect(await as(alice, `SELECT name FROM boards WHERE id = '${ids.board}'`)).toEqual([{ name: 'Team board' }])
  })

  it('shows emails only to people who share a board', async () => {
    expect(await as(bob, 'SELECT email FROM profiles ORDER BY email')).toEqual([
      { email: 'alice@example.com' },
      { email: 'bob@example.com' },
    ])
    expect(await as(carol, 'SELECT email FROM profiles')).toEqual([{ email: 'carol@example.com' }])
    await expect(as(bob, 'SELECT email FROM auth.users')).rejects.toThrow()
  })

  it('lets a member leave and the owner remove anyone, but not members remove each other', async () => {
    await as(alice, `SELECT invite_board_member('${ids.board}', 'carol@example.com')`)
    await as(bob, `DELETE FROM board_members WHERE user_id = '${carol}'`)
    expect(await as(carol, `SELECT id FROM boards`)).toEqual([{ id: ids.board }])

    await as(bob, `DELETE FROM board_members WHERE user_id = '${bob}'`)
    expect(await as(bob, 'SELECT id FROM cards')).toEqual([])

    await as(alice, `DELETE FROM board_members WHERE user_id = '${carol}'`)
    expect(await as(carol, 'SELECT id FROM boards')).toEqual([])
  })

  it('keeps todos private', async () => {
    await as(alice, `INSERT INTO todos (text, position) VALUES ('Mine', 1)`)
    expect(await as(bob, 'SELECT id FROM todos')).toEqual([])
  })
})
