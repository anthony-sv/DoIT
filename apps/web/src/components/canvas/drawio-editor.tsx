// Diagram editor: draw.io in an iframe, driven by its JSON postMessage
// protocol (https://www.drawio.com/doc/faq/embed-mode). No npm package and no
// bundle cost; the diagram XML only travels between this page and the iframe.
import { useEffect, useId, useImperativeHandle, useRef, type Ref } from 'react'
import { type CanvasEditorHandle, type Debounced, type DiagramData, debounce } from './canvas-file'

// A self-hosted draw.io (the jgraph/drawio image) keeps diagrams off the internet.
const DRAWIO_URL = import.meta.env.VITE_DRAWIO_URL || 'https://embed.diagrams.net/'
const DRAWIO_ORIGIN = new URL(DRAWIO_URL).origin

// draw.io keeps Tab/Shift+Tab (they select shapes). While a shape is selected its
// typing shim cancels F6/Alt+D, and Ctrl/Cmd+L is its Lock/Unlock, so no key leaves
// the iframe. It binds nothing to F6: have it forward F6 to us.
const passThroughKeys = [
  { key: 'F6', command: 'leave' },
  { key: 'F6', shift: true, command: 'leave' },
]

export interface DrawioEditorProps {
  name: string
  initialData: DiagramData | null
  dark: boolean
  /**
   * Called at most once a second while editing, and on unmount/pagehide.
   * Resolves to whether the write landed.
   */
  onSave: (data: DiagramData) => Promise<boolean>
  /** Called on every change draw.io reports, before the debounced onSave carries it. */
  onDirty?: () => void
  /** F6 in draw.io: put focus back on the page. Without it the iframe just blurs. */
  onLeave?: () => void
  ref?: Ref<CanvasEditorHandle>
}

type DrawioEvent =
  | { event: 'configure' }
  | { event: 'init' }
  | { event: 'load'; xml?: string }
  | { event: 'autosave' | 'save'; xml: string; exit?: boolean }
  | { event: 'export'; format: string; data: string; xml?: string; message?: { requestId?: string } } // message = our request
  | { event: 'shortcut'; command?: string } // a passThroughKeys command
  | { event: 'exit'; modified?: boolean }
  | { event: string; [key: string]: unknown }

function editorUrl(dark: boolean) {
  const params = new URLSearchParams({
    embed: '1',
    proto: 'json',
    // draw.io asks for our config (passThroughKeys) and waits for it to start.
    configure: '1',
    spin: '1',
    ui: 'min', // minimal chrome; 'kennedy' is the classic full UI
    dark: dark ? '1' : '0',
    libraries: '1',
    // Autosave only: hide Save, Save & Exit and Exit.
    noSaveBtn: '1',
    saveAndExit: '0',
    noExitBtn: '1',
    // No usage logging to draw.io, no cloud integrations, no server-side export.
    stealth: '1',
  })
  const url = new URL(DRAWIO_URL)
  url.search = params.toString()
  return url.toString()
}

/**
 * The PNG in draw.io's export reply, or null when the export failed. draw.io
 * answers a failed export as if it worked: with its 1x1 blank image
 * (Editor.blankImage) when rendering throws, or with 'data:,' when the browser
 * couldn't allocate the canvas. iOS Safari allows 4096x4096 px, while draw.io
 * caps the canvas at 64 MP and each side at 16384 px.
 */
function exportedPng(dataUri: unknown): Blob | null {
  const prefix = 'data:image/png;base64,'
  if (typeof dataUri !== 'string' || !dataUri.startsWith(prefix)) return null
  try {
    const bytes = Uint8Array.from(atob(dataUri.slice(prefix.length)), (c) => c.charCodeAt(0))
    // A PNG stores its width and height at bytes 16-23 (IHDR).
    const view = new DataView(bytes.buffer)
    if (bytes.length < 24 || view.getUint32(16) * view.getUint32(20) <= 1) return null
    return new Blob([bytes], { type: 'image/png' })
  } catch {
    return null // bad base64
  }
}

export default function DrawioEditor({
  name,
  initialData,
  dark,
  onSave,
  onDirty,
  onLeave,
  ref,
}: DrawioEditorProps) {
  const frame = useRef<HTMLIFrameElement>(null)
  const hintId = useId()
  // Latest XML: survives the iframe reload when the theme changes.
  const latestXml = useRef(initialData?.xml ?? '')
  const pendingExports = useRef(new Map<string, (dataUri: string) => void>())
  const onSaveRef = useRef(onSave)
  const onDirtyRef = useRef(onDirty)
  const onLeaveRef = useRef(onLeave)
  // Read on each `init`; a rename shouldn't tear down the message listener.
  const nameRef = useRef(name)
  useEffect(() => {
    onSaveRef.current = onSave
    onDirtyRef.current = onDirty
    onLeaveRef.current = onLeave
    nameRef.current = name
  })
  const saveRef = useRef<Debounced<[string]> | null>(null)

  useEffect(() => {
    const post = (message: object) =>
      frame.current?.contentWindow?.postMessage(JSON.stringify(message), DRAWIO_ORIGIN)
    // draw.io sends autosave on every model change; write at most once a second.
    const save = debounce((xml: string) => {
      void onSaveRef.current({ xml }).then((saved) => {
        // draw.io can't see our autosave, so it would warn "Leave site?" on
        // every reload. Clear its modified flag once nothing newer is pending.
        if (saved && xml === latestXml.current) post({ action: 'status', modified: false })
      })
    }, 1000)
    saveRef.current = save

    // A label still being typed isn't in the model, so no autosave, flush or
    // getData() has it, and draw.io doesn't apply it when focus leaves the
    // iframe (its blurEnabled is false; Chrome fires no blur on the iframe
    // element either). This window gets `focus` on the pointerdown that leaves
    // draw.io: resetEditor applies the label (and clears the selection), and
    // its autosave lands before that click navigates, exports or switches theme.
    // Until draw.io has loaded, post() is dropped (the target origin differs).
    const commitLabel = () => post({ action: 'resetEditor' })
    window.addEventListener('focus', commitLabel)

    function onMessage(e: MessageEvent) {
      // Only the iframe we created, from draw.io's origin, speaking JSON.
      if (e.origin !== DRAWIO_ORIGIN || e.source !== frame.current?.contentWindow) return
      if (typeof e.data !== 'string') return
      let msg: DrawioEvent
      try {
        msg = JSON.parse(e.data) as DrawioEvent
      } catch {
        return
      }
      switch (msg.event) {
        case 'configure':
          post({ action: 'configure', config: { passThroughKeys } })
          break
        case 'init':
          post({ action: 'load', xml: latestXml.current, autosave: 1, title: nameRef.current })
          break
        case 'autosave':
        case 'save': {
          const xml = (msg as { xml: string }).xml
          if (xml && xml !== latestXml.current) {
            latestXml.current = xml
            onDirtyRef.current?.()
            save(xml)
          }
          break
        }
        case 'export': {
          const { data, message } = msg as Extract<DrawioEvent, { event: 'export' }>
          const id = message?.requestId
          const resolve = id ? pendingExports.current.get(id) : undefined
          if (id && resolve) {
            pendingExports.current.delete(id)
            resolve(data)
          }
          break
        }
        case 'shortcut':
          if ((msg as { command?: string }).command === 'leave') {
            if (onLeaveRef.current) onLeaveRef.current()
            else frame.current?.blur()
          }
          break
      }
    }

    window.addEventListener('message', onMessage)
    const flush = () => save.flush()
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('focus', commitLabel)
      window.removeEventListener('pagehide', flush)
      save.flush() // leaving the page saves the last change
      saveRef.current = null
    }
  }, [])

  useImperativeHandle(ref, () => {
    /** One PNG export at `scale`; null when draw.io answers with a failed one. */
    const requestPng = (scale: number) =>
      new Promise<Blob | null>((resolve, reject) => {
        const win = frame.current?.contentWindow
        if (!win) return reject(new Error('The diagram editor is still loading.'))
        const requestId = crypto.randomUUID()
        const timer = setTimeout(() => {
          pendingExports.current.delete(requestId)
          reject(new Error('draw.io did not answer the export request.'))
        }, 15_000)
        pendingExports.current.set(requestId, (dataUri) => {
          clearTimeout(timer)
          resolve(exportedPng(dataUri))
        })
        // 'xmlpng' would embed the diagram so the PNG reopens in draw.io.
        // draw.io echoes the whole request back as `message` on the export event.
        win.postMessage(
          JSON.stringify({
            action: 'export',
            format: 'png',
            scale,
            border: 16,
            // Always light, so the PNG pastes well into documents.
            background: '#ffffff',
            requestId,
          }),
          DRAWIO_ORIGIN,
        )
      })

    return {
      getData: () => ({ xml: latestXml.current }),
      flush: () => saveRef.current?.flush(),
      exportPng: async () => {
        // Scale 1 needs a quarter of the pixels, so a diagram too big for this
        // browser's canvas at 2 can still fit (iOS Safari up to ~4096x4096 px).
        const png = (await requestPng(2)) ?? (await requestPng(1))
        if (!png) {
          throw new Error(
            'draw.io couldn’t draw the PNG. A very large diagram may not fit in this browser; the .drawio export still works.',
          )
        }
        return png
      },
    }
  }, [])

  return (
    <>
      <iframe
        // Reload with the other theme; init re-sends latestXml.
        key={dark ? 'dark' : 'light'}
        ref={frame}
        title={`${name} (draw.io)`}
        aria-describedby={hintId}
        src={editorUrl(dark)}
        className="size-full border-0"
        allow="clipboard-read; clipboard-write"
        // embed.diagrams.net answers 403 when the Referer has a port
        // (http://localhost:5310/), so local dev breaks without this.
        referrerPolicy="no-referrer"
      />
      <p id={hintId} className="sr-only">
        Tab and Shift+Tab move between shapes. Press F6 to go back to the page.
      </p>
    </>
  )
}
