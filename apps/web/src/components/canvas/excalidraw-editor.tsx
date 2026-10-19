// Whiteboard editor. Only ever loaded through React.lazy (see the canvas
// route): Excalidraw is ~1 MB of JS + 145 KB of CSS and touches `window` at
// import time, so it must stay out of the main bundle and out of anything the
// server evaluates. Its canvas fonts load from Excalidraw's CDN (esm.sh).
import '@excalidraw/excalidraw/index.css'
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import {
  Excalidraw,
  MainMenu,
  exportToBlob,
  hashElementsVersion,
  restore,
  serializeAsJSON,
} from '@excalidraw/excalidraw'
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import {
  type CanvasEditorHandle,
  CanvasFileError,
  type Debounced,
  type WhiteboardData,
  debounce,
} from './canvas-file'

export interface ExcalidrawEditorProps {
  name: string
  initialData: WhiteboardData | null
  dark: boolean
  /**
   * Called at most once a second while drawing, and right away on Mod+S,
   * hiding, unloading and unmount. Resolves to whether the write landed.
   */
  onSave: (data: WhiteboardData) => Promise<boolean>
  /** Called on every content change, before the debounced onSave carries it. */
  onDirty?: () => void
  ref?: Ref<CanvasEditorHandle>
}

// Changes worth saving: element edits (versionNonce hash covers deletes too),
// added images, and the appState a saved file keeps (serializeAsJSON 'local'
// keeps viewBackgroundColor, gridModeEnabled, gridSize and gridStep, and
// restore reads them back). Scrolling, zoom and selection are not.
function contentKey(elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) {
  const { viewBackgroundColor, gridModeEnabled, gridSize, gridStep } = appState
  return [
    hashElementsVersion(elements),
    viewBackgroundColor,
    gridModeEnabled,
    gridSize,
    gridStep,
    Object.keys(files).length,
  ].join(':')
}

function toData(elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) {
  // 'local' keeps the images that elements still use; 'database' would drop
  // `files` entirely (excalidraw.com stores them elsewhere).
  return JSON.parse(serializeAsJSON(elements, appState, files, 'local')) as WhiteboardData
}

/**
 * A whiteboard as Excalidraw's own loader reads it. restore() repairs what it
 * can and throws on what it can't (a null element, a string appState, a
 * numeric link, a line without points); serializing drops files no image
 * uses, null ones included. Excalidraw runs restore() on initialData outside
 * its try/catch, so data that fails here would leave it loading for good.
 */
export function normalizeWhiteboard(data: WhiteboardData): WhiteboardData {
  try {
    const scene = restore(data as ExcalidrawInitialDataState, null, null, { repairBindings: true })
    return JSON.parse(serializeAsJSON(scene.elements, scene.appState, scene.files, 'local')) as WhiteboardData
  } catch {
    throw new CanvasFileError('This whiteboard file is damaged, so it can’t be opened.')
  }
}

export default function ExcalidrawEditor({
  name,
  initialData,
  dark,
  onSave,
  onDirty,
  ref,
}: ExcalidrawEditorProps) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const lastKey = useRef<string | null>(null)
  const onSaveRef = useRef(onSave)
  useEffect(() => {
    onSaveRef.current = onSave
  })

  // Excalidraw reads initialData once, on mount. Remount (key) to load another file.
  const [seed] = useState((): { data: WhiteboardData | null } | { error: string } => {
    try {
      return { data: initialData && normalizeWhiteboard(initialData) }
    } catch (error) {
      return { error: (error as Error).message }
    }
  })

  // Content changes so far. dirty stays set until a write carrying the latest
  // one lands; a failed write leaves it set.
  const changes = useRef(0)
  const [dirty, setDirty] = useState(false)

  // Debounced writer, created in an effect so render never touches refs.
  const saveRef = useRef<Debounced<[readonly ExcalidrawElement[], AppState, BinaryFiles]> | null>(null)
  useEffect(() => {
    const save = debounce((elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      const carries = changes.current
      void onSaveRef.current(toData(elements, appState, files)).then((saved) => {
        if (saved && carries === changes.current) setDirty(false)
      })
    }, 1000)
    saveRef.current = save
    const flush = () => save.flush()
    // Hiding is the last event a mobile browser reliably fires before it
    // discards the tab; pagehide may never come.
    const flushIfHidden = () => {
      if (document.visibilityState === 'hidden') save.flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flushIfHidden)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flushIfHidden)
      save.flush() // leaving the page saves the last strokes
      saveRef.current = null
    }
  }, [])

  // Unloading cancels a request still in flight, so the pagehide flush can't be
  // trusted. Ask before closing or reloading while a change isn't saved; the
  // flush starts its write while the prompt is open.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      saveRef.current?.flush()
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  useImperativeHandle(
    ref,
    () => ({
      getData: () => (api ? toData(api.getSceneElements(), api.getAppState(), api.getFiles()) : null),
      flush: () => saveRef.current?.flush(),
      // exportToBlob's d.ts re-exports from "@excalidraw/utils/export", which
      // isn't published; tsconfig paths point it at the types Excalidraw ships
      // (without them it is `any`).
      exportPng: async (): Promise<Blob> => {
        if (!api) throw new Error('The whiteboard is still loading.')
        const scale = 2
        return exportToBlob({
          elements: api.getSceneElements(),
          files: api.getFiles(),
          mimeType: 'image/png',
          exportPadding: 24,
          appState: {
            ...api.getAppState(),
            // Always light, so the PNG pastes well into documents.
            exportBackground: true,
            exportWithDarkMode: false,
            // Puts the scene JSON inside the PNG: dropping the PNG back on
            // excalidraw.com (or loadFromBlob) reopens it as an editable drawing.
            exportEmbedScene: true,
          },
          // exportToBlob ignores appState.exportScale; scale via getDimensions.
          getDimensions: (width: number, height: number) => ({
            width: width * scale,
            height: height * scale,
            scale,
          }),
        })
      },
    }),
    [api],
  )

  // No editor, so getData() stays null and the page exports the stored copy.
  if ('error' in seed) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyTitle>This whiteboard can’t be opened</EmptyTitle>
          <EmptyDescription>{seed.error} Import a file to replace it.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <Excalidraw
      name={name}
      initialData={seed.data as ExcalidrawInitialDataState | null}
      excalidrawAPI={setApi}
      theme={dark ? 'dark' : 'light'}
      onChange={(elements, appState, files) => {
        const key = contentKey(elements, appState, files)
        if (lastKey.current === null) {
          // First call is the initial render: nothing to save yet.
          lastKey.current = key
          return
        }
        if (key === lastKey.current) return
        lastKey.current = key
        changes.current += 1
        setDirty(true)
        onDirty?.()
        saveRef.current?.(elements, appState, files)
      }}
      UIOptions={{
        canvasActions: {
          // DoIT's toolbar owns open/save/export; keep Excalidraw's image dialog.
          loadScene: false,
          saveToActiveFile: false,
          export: false,
          toggleTheme: false,
        },
      }}
    >
      <MainMenu>
        <MainMenu.DefaultItems.SaveAsImage />
        <MainMenu.DefaultItems.ClearCanvas />
        <MainMenu.DefaultItems.ChangeCanvasBackground />
        <MainMenu.Separator />
        <MainMenu.DefaultItems.Help />
      </MainMenu>
    </Excalidraw>
  )
}
