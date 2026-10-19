// The board you were last on. Pages that aren't a board (todos, canvases)
// keep showing it in the sidebar, and "/" opens it.
const KEY = 'doit-last-board'

export function readLastBoard(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function rememberBoard(boardId: string) {
  try {
    localStorage.setItem(KEY, boardId)
  } catch {
    // Storage blocked: "/" falls back to the first board.
  }
}
