import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Board, Card } from '@/data/schemas'
import {
  INBOX,
  assignedCards,
  cardsToImport,
  positionBetweenOpen,
  readCollapsed,
  rememberCollapsed,
  todoLists,
} from './todos'

describe('todoLists', () => {
  it('has a list for the inbox and every section, even empty ones', () => {
    expect(todoLists(['s1', 's2'], [])).toEqual({ [INBOX]: [], s1: [], s2: [] })
  })

  it('groups todos by section and keeps their order', () => {
    const todos = [
      { id: 'a', section_id: 's1' },
      { id: 'b', section_id: null },
      { id: 'c', section_id: 's1' },
      { id: 'd', section_id: null },
    ]
    expect(todoLists(['s1'], todos)).toEqual({ [INBOX]: ['b', 'd'], s1: ['a', 'c'] })
  })

  it('shows todos of a deleted section in the inbox', () => {
    expect(todoLists([], [{ id: 'a', section_id: 'gone' }])).toEqual({ [INBOX]: ['a'] })
  })
})

describe('positionBetweenOpen', () => {
  it('splits the gap when no completed todo is in it', () => {
    expect(positionBetweenOpen(1024, 2048, [512, 4096])).toBe(1536)
  })

  it('goes past the completed todos in the gap instead of tying with one', () => {
    // Splitting 1024..2048 would land exactly on the completed todo.
    expect(positionBetweenOpen(1024, 2048, [1536])).toBe(1792)
    expect(positionBetweenOpen(1024, 2048, [1792, 1280])).toBe(1920)
  })

  it('goes past completed todos at the ends of the list too', () => {
    expect(positionBetweenOpen(undefined, 2048, [1024])).toBe(1536)
    expect(positionBetweenOpen(1024, undefined, [2048])).toBe(3072)
    expect(positionBetweenOpen(undefined, undefined, [2048, 1024])).toBe(3072)
    expect(positionBetweenOpen(undefined, undefined, [])).toBe(1024)
  })

  it('keeps the open order and never ties with a completed todo, for every drop index', () => {
    const open = [1024, 2048, 3072]
    // Splitting the gaps after 1024, 2048 and 3072 would tie with these.
    const done = [512, 1536, 2560, 2816, 4096]
    for (let index = 0; index <= open.length; index++) {
      const p = positionBetweenOpen(open[index - 1], open[index], done)
      if (index > 0) expect(p).toBeGreaterThan(open[index - 1]!)
      if (index < open.length) expect(p).toBeLessThan(open[index]!)
      expect(done).not.toContain(p)
    }
  })
})

describe('collapsed lists', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubStorage(initial: Record<string, string> = {}) {
    const values = new Map(Object.entries(initial))
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    })
    return values
  }

  it('round-trips through storage', () => {
    const values = stubStorage()
    expect(readCollapsed()).toEqual([])
    rememberCollapsed([INBOX, 's1'])
    expect(readCollapsed()).toEqual([INBOX, 's1'])
    rememberCollapsed([])
    expect(values.size).toBe(0)
  })

  it('ignores anything that is not a list of ids', () => {
    stubStorage({ 'doit-collapsed-todo-lists': '{"s1":true}' })
    expect(readCollapsed()).toEqual([])
    stubStorage({ 'doit-collapsed-todo-lists': '["s1",2,null]' })
    expect(readCollapsed()).toEqual(['s1'])
    stubStorage({ 'doit-collapsed-todo-lists': 'not json' })
    expect(readCollapsed()).toEqual([])
  })

  it('works without storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(readCollapsed()).toEqual([])
    expect(() => rememberCollapsed(['s1'])).not.toThrow()
  })
})

describe('assigned cards', () => {
  const me = 'me'
  const other = 'other'

  function board(id: string, rest: Partial<Board> = {}): Board {
    return {
      id,
      owner_id: me,
      name: id,
      key: id.toUpperCase(),
      color: 'blue',
      position: 1024,
      next_number: 1,
      archived_at: null,
      created_at: '2026-01-01T00:00:00Z',
      ...rest,
    }
  }

  function card(id: string, rest: Partial<Card> = {}): Card {
    return {
      id,
      owner_id: me,
      board_id: 'a',
      column_id: 'todo',
      sprint_id: null,
      story_id: null,
      assignee_id: me,
      number: 1,
      title: id,
      description: '',
      priority: 'medium',
      due_on: null,
      label_ids: [],
      estimate: null,
      color: null,
      position: 1024,
      backlog_position: 1024,
      completed_at: null,
      created_by: me,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      ...rest,
    }
  }

  const columns = [
    { id: 'todo', is_done: false },
    { id: 'done', is_done: true },
  ]

  /** Board ids, each with its card ids, as the dialog lists them. */
  function listed(groups: ReturnType<typeof assignedCards>) {
    return groups.map((g) => [g.board.id, g.cards.map((c) => c.card.id)])
  }

  it('lists only your open cards on boards that are not archived', () => {
    const groups = assignedCards({
      userId: me,
      boards: [board('a'), board('old', { archived_at: '2026-02-01T00:00:00Z' })],
      columns,
      cards: [
        card('mine'),
        card('theirs', { assignee_id: other }),
        card('nobody', { assignee_id: null }),
        card('finished', { column_id: 'done' }),
        card('archived', { board_id: 'old' }),
        card('no board', { board_id: 'gone' }),
      ],
      todos: [],
    })
    expect(listed(groups)).toEqual([['a', ['mine']]])
  })

  it('puts your boards first in sidebar order, then shared boards by name', () => {
    const groups = assignedCards({
      userId: me,
      boards: [
        board('zed', { owner_id: other, name: 'Zed', position: 1 }),
        board('second', { position: 2048 }),
        board('alpha', { owner_id: other, name: 'Alpha', position: 9999 }),
        board('first', { position: 1024 }),
        board('empty', { position: 0 }),
      ],
      columns,
      cards: ['zed', 'second', 'alpha', 'first'].map((b) => card(`${b}-card`, { board_id: b })),
      todos: [],
    })
    expect(groups.map((g) => g.board.id)).toEqual(['first', 'second', 'alpha', 'zed'])
  })

  it('orders a board by due date, undated last, then by number', () => {
    const groups = assignedCards({
      userId: me,
      boards: [board('a')],
      columns,
      cards: [
        card('undated 2', { number: 2 }),
        card('later', { number: 9, due_on: '2026-11-20' }),
        card('undated 1', { number: 1 }),
        card('soon 5', { number: 5, due_on: '2026-10-24' }),
        card('soon 3', { number: 3, due_on: '2026-10-24' }),
      ],
      todos: [],
    })
    expect(listed(groups)).toEqual([['a', ['soon 3', 'soon 5', 'later', 'undated 1', 'undated 2']]])
  })

  it('gives each card its key and marks the ones already in your todos', () => {
    const groups = assignedCards({
      userId: me,
      boards: [board('a', { key: 'DSC' })],
      columns,
      cards: [card('new', { number: 14 }), card('open todo', { number: 15 }), card('done todo', { number: 16 })],
      todos: [{ card_id: 'open todo' }, { card_id: 'done todo' }, { card_id: null }],
    })
    expect(groups[0]!.cards.map(({ key, imported }) => ({ key, imported }))).toEqual([
      { key: 'DSC-14', imported: false },
      { key: 'DSC-15', imported: true },
      { key: 'DSC-16', imported: true },
    ])
  })

  it('imports what is not in your todos yet, less what was unticked, in list order', () => {
    const groups = assignedCards({
      userId: me,
      boards: [board('b', { position: 2048 }), board('a')],
      columns,
      cards: [
        card('b1', { board_id: 'b', number: 1 }),
        card('a2', { number: 2 }),
        card('a1', { number: 1 }),
        card('a3', { number: 3 }),
      ],
      todos: [{ card_id: 'a2' }],
    })
    const ids = (skipped: string[]) =>
      cardsToImport(groups, new Set(skipped)).map((c) => c.card.id)
    expect(ids([])).toEqual(['a1', 'a3', 'b1'])
    expect(ids(['a3'])).toEqual(['a1', 'b1'])
    // An imported card never comes back, ticked or not.
    expect(ids(['a2'])).toEqual(['a1', 'a3', 'b1'])
    expect(ids(['a1', 'a3', 'b1'])).toEqual([])
  })

  it('has nothing to list when nothing is assigned to you', () => {
    expect(
      assignedCards({ userId: me, boards: [board('a')], columns, cards: [], todos: [] }),
    ).toEqual([])
  })
})
