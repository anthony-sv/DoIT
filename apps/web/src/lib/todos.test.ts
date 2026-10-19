import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  INBOX,
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
