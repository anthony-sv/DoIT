// What a drawing stores in canvases.data, and the files it imports and
// exports. No editor code here, so the sidebar and the tests can import it
// without pulling either engine into their chunk.
import type { CanvasKind } from '@/data/schemas'

/** Whiteboard: the .excalidraw file object, exactly what serializeAsJSON returns. */
export interface WhiteboardData {
  type: 'excalidraw'
  version: number
  source?: string
  elements: readonly unknown[]
  appState?: Record<string, unknown>
  files?: Record<string, unknown>
}

/** Diagram: the draw.io document (<mxfile>…</mxfile>), uncompressed by default. */
export interface DiagramData {
  xml: string
}

export type CanvasData = WhiteboardData | DiagramData

/** DoIT's own export: any drawing as one JSON file. */
export interface CanvasBundle {
  doit: 'canvas'
  version: 1
  kind: CanvasKind
  name: string
  data: CanvasData
}

export interface CanvasEditorHandle {
  /** The document as it stands, in the shape stored in canvases.data. */
  getData(): CanvasData | null
  /** A PNG of the whole drawing. */
  exportPng(): Promise<Blob>
  /** Hands a change still waiting in the debounce to onSave right now. */
  flush(): void
}

export const emptyWhiteboard: WhiteboardData = {
  type: 'excalidraw',
  version: 2,
  elements: [],
  appState: {},
  files: {},
}

export const emptyDiagram: DiagramData = { xml: '' }

// What draw.io writes for a new diagram; a .drawio file can't be empty.
const blankMxfile =
  '<mxfile><diagram name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>'

export function isWhiteboardData(value: unknown): value is WhiteboardData {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'excalidraw' &&
    Array.isArray((value as { elements?: unknown }).elements)
  )
}

export function isDiagramData(value: unknown): value is DiagramData {
  return (
    typeof value === 'object' && value !== null && typeof (value as { xml?: unknown }).xml === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// What Excalidraw's own Open keeps of a file's appState (cleanAppStateForExport).
// The rest is session state (view/zen mode, error dialog, open menus,
// collaborators…), which restoreAppState would apply as is.
const fileAppStateKeys = ['gridSize', 'gridStep', 'gridModeEnabled', 'viewBackgroundColor'] as const

/**
 * A whiteboard cut down to what Excalidraw's own Open keeps, minus `iframe`
 * elements: Excalidraw runs their customData.generationData.html as a page with
 * scripts, forms and popups. Only its Magic Frame makes them, and DoIT has none.
 */
function cleanWhiteboard(data: WhiteboardData): WhiteboardData {
  const appState: Record<string, unknown> = isRecord(data.appState) ? data.appState : {}
  return {
    type: 'excalidraw',
    version: typeof data.version === 'number' ? data.version : 2,
    ...(typeof data.source === 'string' ? { source: data.source } : {}),
    elements: data.elements.filter((element) => isRecord(element) && element.type !== 'iframe'),
    appState: Object.fromEntries(
      fileAppStateKeys.filter((key) => key in appState).map((key) => [key, appState[key]]),
    ),
    files: isRecord(data.files) ? data.files : {},
  }
}

/**
 * canvases.data as the editor's starting document. The column default `{}`
 * (a drawing nobody has touched yet) gives null: the editor starts empty.
 * A whiteboard comes back cleaned, like an imported file.
 */
export function storedData(kind: CanvasKind, value: unknown): CanvasData | null {
  if (kind === 'whiteboard') return isWhiteboardData(value) ? cleanWhiteboard(value) : null
  return isDiagramData(value) ? value : null
}

export function emptyData(kind: CanvasKind): CanvasData {
  return kind === 'whiteboard' ? emptyWhiteboard : emptyDiagram
}

/** Nothing worth keeping: replacing it needs no confirmation, exporting it no PNG. */
export function isEmptyDrawing(data: CanvasData | null): boolean {
  if (!data) return true
  if (isWhiteboardData(data)) {
    // Damaged data (a null element) counts as nothing rather than throwing.
    return !data.elements.some((element) => isRecord(element) && !element.isDeleted)
  }
  const xml = data.xml.trim()
  if (!xml) return true
  // Shapes and lines carry vertex="1" or edge="1"; a blank page only has
  // draw.io's two root cells. A compressed page (base64 inside <diagram>)
  // can't be read here, so it counts as content.
  const compressed = /<diagram\b[^>]*>\s*[^<\s]/.test(xml)
  return !compressed && !/\b(?:vertex|edge)="1"/.test(xml)
}

function isDiagramXml(text: string) {
  const head = text.trimStart().slice(0, 200)
  return head.startsWith('<mxfile') || head.startsWith('<mxGraphModel') || head.startsWith('<?xml')
}

export class CanvasFileError extends Error {}

/** A drawing name from a file, within the 80 characters a name allows. */
function nameFrom(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 80).trim() : ''
}

/** Reads a dropped or picked file: DoIT JSON, .excalidraw, or .drawio / .xml. */
export async function readCanvasFile(
  file: File,
): Promise<{ kind: CanvasKind; name: string; data: CanvasData }> {
  const text = await file.text()
  const baseName =
    nameFrom(file.name.replace(/(\.doit)?\.(json|excalidraw|drawio|xml)$/i, '')) || 'Imported drawing'

  if (isDiagramXml(text)) {
    if (!text.includes('<mxGraphModel') && !text.includes('<diagram')) {
      throw new CanvasFileError('This XML file isn’t a draw.io diagram.')
    }
    return { kind: 'diagram', name: baseName, data: { xml: text } }
  }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new CanvasFileError('DoIT can’t read this file. Use a DoIT JSON, .excalidraw or .drawio file.')
  }

  const bundle = json as Partial<CanvasBundle> | null
  if (bundle?.doit === 'canvas' && (bundle.kind === 'whiteboard' || bundle.kind === 'diagram')) {
    const data = storedData(bundle.kind, bundle.data)
    if (!data) throw new CanvasFileError('This DoIT file is damaged: its drawing doesn’t match its kind.')
    return { kind: bundle.kind, name: nameFrom(bundle.name) || baseName, data }
  }
  if (isWhiteboardData(json)) return { kind: 'whiteboard', name: baseName, data: cleanWhiteboard(json) }
  if (typeof json === 'object' && json !== null) {
    if ('tldrawFileFormatVersion' in json) {
      throw new CanvasFileError(
        'tldraw (.tldr) files can’t be opened here. Export a PNG from tldraw and paste it onto a whiteboard.',
      )
    }
    if ((json as { type?: unknown }).type === 'excalidrawlib') {
      throw new CanvasFileError('That’s an Excalidraw library, not a drawing.')
    }
  }
  throw new CanvasFileError('DoIT doesn’t recognize this file. Use a DoIT JSON, .excalidraw or .drawio file.')
}

/** Importing into an open drawing: only a file of the same kind fits. */
export function assertSameKind(fileKind: CanvasKind, canvasKind: CanvasKind) {
  if (fileKind !== canvasKind) {
    throw new CanvasFileError(
      `That file is a ${fileKind} and this drawing is a ${canvasKind}. Use Import file… in the sidebar to open it as a new ${fileKind}.`,
    )
  }
}

export function toBundle(kind: CanvasKind, name: string, data: CanvasData): CanvasBundle {
  return { doit: 'canvas', version: 1, kind, name, data }
}

/** A drawing name made safe to use as a download's file name. */
export function fileName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'drawing'
}

/** Native file for the engine: opens in excalidraw.com or draw.io as is. */
export function toNativeFile(kind: CanvasKind, name: string, data: CanvasData): File {
  return kind === 'whiteboard'
    ? new File([JSON.stringify(data, null, 2)], `${fileName(name)}.excalidraw`, {
        type: 'application/vnd.excalidraw+json',
      })
    : new File([(data as DiagramData).xml.trim() || blankMxfile], `${fileName(name)}.drawio`, {
        type: 'application/vnd.jgraph.mxfile',
      })
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadBundle(kind: CanvasKind, name: string, data: CanvasData) {
  const json = JSON.stringify(toBundle(kind, name, data), null, 2)
  downloadBlob(new Blob([json], { type: 'application/json' }), `${fileName(name)}.doit.json`)
}

export type Debounced<A extends unknown[]> = ((...args: A) => void) & { flush(): void; cancel(): void }

/** Calls fn after `wait` ms of quiet, with a flush for unmount/pagehide. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: A | undefined
  const run = () => {
    timer = undefined
    if (pending) {
      const args = pending
      pending = undefined
      fn(...args)
    }
  }
  const debounced = (...args: A) => {
    pending = args
    clearTimeout(timer)
    timer = setTimeout(run, wait)
  }
  debounced.flush = () => {
    clearTimeout(timer)
    run()
  }
  debounced.cancel = () => {
    clearTimeout(timer)
    pending = undefined
  }
  return debounced
}
