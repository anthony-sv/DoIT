// One drawing: a whiteboard (Excalidraw) or a diagram (draw.io). The list
// collection leaves out `data`, so this page reads and writes canvases.data
// itself, one write at a time.
import { Suspense, lazy, useEffect, useEffectEvent, useRef, useState } from 'react'
import { Link, createFileRoute, notFound, useBlocker } from '@tanstack/react-router'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { useHotkey } from '@tanstack/react-hotkeys'
import { DownloadIcon, FileCodeIcon, FileJsonIcon, ImageIcon, UploadIcon } from 'lucide-react'
import {
  type CanvasData,
  type CanvasEditorHandle,
  type DiagramData,
  type WhiteboardData,
  assertSameKind,
  downloadBlob,
  downloadBundle,
  emptyData,
  fileName,
  isEmptyDrawing,
  readCanvasFile,
  storedData,
  toNativeFile,
} from '@/components/canvas/canvas-file'
import { CanvasMenu } from '@/components/canvas/canvas-menu'
import { deletedHere, kindIcons, kindLabels } from '@/components/canvas/canvas-ui'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { canvasesCollection } from '@/data/collections'
import type { CanvasKind } from '@/data/schemas'
import { useIsDark } from '@/hooks/use-is-dark'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// Nitro still builds a server, which never renders this page (defaultSsr:
// false). import.meta.env.SSR is a build-time constant, so the server bundle
// drops Excalidraw (and its mermaid/cytoscape chunks) entirely.
const clientOnly = new Error('Canvas editors only load in the browser.')
const loadEditor = {
  whiteboard: () =>
    import.meta.env.SSR ? Promise.reject(clientOnly) : import('@/components/canvas/excalidraw-editor'),
  diagram: () =>
    import.meta.env.SSR ? Promise.reject(clientOnly) : import('@/components/canvas/drawio-editor'),
}
const ExcalidrawEditor = lazy(loadEditor.whiteboard)
const DrawioEditor = lazy(loadEditor.diagram)

/** Starts downloading an editor's chunk; the lazy editor reports a failure itself. */
function warmEditor(kind: CanvasKind) {
  loadEditor[kind]().catch(() => undefined)
}

interface CanvasRow {
  id: string
  name: string
  kind: CanvasKind
  data: unknown
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function saveCanvasData(id: string, data: CanvasData) {
  const { data: rows, error } = await supabase
    .from('canvases')
    .update({ data })
    .eq('id', id)
    .select('id')
  if (error) throw new Error(error.message)
  // No row: the drawing was deleted, so the write went nowhere. Deleted from
  // this tab, that's expected (the page's last write can land after the
  // delete); deleted elsewhere (another tab or device), it's news.
  if (!rows?.length && !deletedHere.has(id)) {
    throw new Error('This drawing was deleted, so changes can’t be saved.')
  }
}

interface WriteQueue {
  /** The newest document not sent yet, and everyone waiting on it. */
  next: { data: CanvasData; callers: { resolve: () => void; reject: (error: Error) => void }[] } | null
  /** Settles once nothing is left to send; never rejects. */
  done: Promise<void>
}

// Each drawing's writes, one at a time and in order, even across visits: the
// editors flush on unmount, and with pasted images a write can take seconds
// to upload. A write carries the whole drawing, so only the newest document
// waits its turn: a newer one takes its place, and the callers of the one it
// replaced get the result of the write that covers them.
const writeQueues = new Map<string, WriteQueue>()

/** Writes `data` after the drawing's earlier writes; rejects with the error of the write that carried it. */
function queueWrite(id: string, data: CanvasData): Promise<void> {
  return new Promise((resolve, reject) => {
    const queue = writeQueues.get(id) ?? { next: null, done: Promise.resolve() }
    queue.next = { data, callers: [...(queue.next?.callers ?? []), { resolve, reject }] }
    if (!writeQueues.has(id)) {
      writeQueues.set(id, queue)
      queue.done = drainWrites(id, queue)
    }
  })
}

async function drainWrites(id: string, queue: WriteQueue) {
  while (queue.next) {
    const { data, callers } = queue.next
    queue.next = null
    await saveCanvasData(id, data).then(
      () => callers.forEach((caller) => caller.resolve()),
      (error: Error) => callers.forEach((caller) => caller.reject(error)),
    )
  }
  writeQueues.delete(id)
}

export const Route = createFileRoute('/_app/c/$canvasId')({
  loader: {
    // Never seed the editor from a cached copy: it would save that stale copy
    // back over newer edits. Stale data reloads before render, not after.
    staleReloadMode: 'blocking',
    handler: async ({ params, preload }) => {
      if (preload) {
        // Hover preloads (defaultPreload: 'intent') only warm the editor
        // chunk. The drawing can be megabytes of pasted images, and the visit
        // reloads it anyway (preloadStaleTime 0), so it isn't fetched twice.
        // Null never reaches an editor: CanvasRoute renders nothing for it.
        const kind = canvasesCollection.get(params.canvasId)?.kind
        if (kind) warmEditor(kind)
        return null
      }
      if (!uuid.test(params.canvasId)) throw notFound()
      // The last visit may still be writing (its unmount flush, or an upload
      // of pasted images). Read after it, or the editor opens without those
      // changes and its next save writes over them.
      await writeQueues.get(params.canvasId)?.done
      const { data, error } = await supabase
        .from('canvases')
        .select('id, name, kind, data')
        .eq('id', params.canvasId)
        .maybeSingle()
      if (error) throw new Error(`Could not load the drawing: ${error.message}`)
      if (!data) throw notFound()
      const row = data as CanvasRow
      warmEditor(row.kind)
      return row
    },
  },
  staleTime: 0,
  preloadStaleTime: 0,
  gcTime: 0,
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.name} · DoIT` : 'Drawing · DoIT' }],
  }),
  notFoundComponent: () => (
    <Empty className="min-h-svh">
      <EmptyHeader>
        <EmptyTitle>Drawing not found</EmptyTitle>
        <EmptyDescription>It may have been deleted, or the link is wrong.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button nativeButton={false} render={<Link to="/" />}>
          Go to your boards
        </Button>
      </EmptyContent>
    </Empty>
  ),
  errorComponent: ({ error }) => (
    <div className="flex min-h-svh flex-col">
      {/* Phones: the sidebar is off-canvas, and the editor header that holds its trigger isn't rendered. */}
      <header className="flex px-3 py-2 md:hidden">
        <SidebarTrigger className="-ml-1" />
      </header>
      <Empty>
        <EmptyHeader>
          <EmptyTitle>The drawing didn’t open</EmptyTitle>
          <EmptyDescription>{error instanceof Error ? error.message : String(error)}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex gap-2">
            {/* A reload also retries an editor download that failed (React.lazy keeps the failure). */}
            <Button onClick={() => window.location.reload()}>Try again</Button>
            {/* Client-side, so it also works offline: the boards are already in memory. */}
            <Button variant="outline" nativeButton={false} render={<Link to="/" />}>
              Go to your boards
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  ),
  component: CanvasRoute,
})

function CanvasRoute() {
  const row = Route.useLoaderData()
  if (!row) return null
  // A new id is a new document: remount so editor state never carries over.
  return <CanvasPage key={row.id} row={row} />
}

function CanvasPage({ row }: { row: CanvasRow }) {
  const dark = useIsDark()
  const editor = useRef<CanvasEditorHandle>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  // Where F6 in the diagram editor puts focus back on the page.
  const heading = useRef<HTMLHeadingElement>(null)
  // The list row, so a rename shows at once; the loaded row if it is gone.
  const { data: canvas } = useLiveQuery({
    query: (q) =>
      q
        .from({ canvas: canvasesCollection })
        .where(({ canvas }) => eq(canvas.id, row.id))
        .findOne(),
  })
  const name = canvas?.name ?? row.name
  const KindIcon = kindIcons[row.kind]

  // head() only runs when the route loads, and a rename is only a collection
  // write: keep the tab title on the live name.
  useEffect(() => {
    document.title = `${name} · DoIT`
  }, [name])

  // `doc` only seeds the editor; bumping `version` remounts it (after import).
  const [doc, setDoc] = useState(() => storedData(row.kind, row.data))
  const [version, setVersion] = useState(0)

  // Documents handed to save() that aren't in Postgres yet, oldest first. A
  // write carries the whole drawing, so a newer one stands in for older ones.
  const unsaved = useRef<{ data: CanvasData; resolve: (saved: boolean) => void }[]>([])
  const retryTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const retries = useRef(0)
  const failing = useRef(false)
  const mounted = useRef(true)
  const [writes, setWrites] = useState(0)
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'failed'>('idle')
  // A change still in the editor's debounce (the whiteboard reports it).
  const [dirty, setDirty] = useState(false)

  /** Resolves to whether this document, or a newer one, reached Postgres (retries included). */
  function save(data: CanvasData): Promise<boolean> {
    setDirty(false) // handed over: `writes` covers it from here
    const saved = new Promise<boolean>((resolve) => unsaved.current.push({ data, resolve }))
    write(data)
    return saved
  }

  /** Settles the oldest `count` unsaved documents. */
  function settle(count: number, saved: boolean) {
    for (const { resolve } of unsaved.current.splice(0, count)) resolve(saved)
  }

  function write(data: CanvasData) {
    clearTimeout(retryTimer.current) // this write carries what a retry would send
    retryTimer.current = undefined
    setWrites((n) => n + 1)
    void queueWrite(row.id, data)
      .then(
        () => {
          // In, and so is every older document; newer ones are on their way.
          settle(unsaved.current.findIndex((u) => u.data === data) + 1, true)
          failing.current = false
          retries.current = 0
          setSaveState('saved')
        },
        (error: Error) => {
          // A newer document is on its way and carries this one: its write decides.
          if (unsaved.current.at(-1)?.data !== data) return
          if (!mounted.current) {
            // The page is gone, and its retries with it: say so and give up.
            toast.add({ title: 'Drawing not saved', description: error.message, type: 'error' })
            settle(unsaved.current.length, false)
            return
          }
          // One toast per run of failures; the header keeps saying "Not saved".
          if (!failing.current) {
            toast.add({ title: 'Drawing not saved', description: error.message, type: 'error' })
          }
          failing.current = true
          setSaveState('failed')
          // Again in 2 s, 4 s … 30 s, or as soon as the browser is back online.
          retryTimer.current = setTimeout(retry, Math.min(2000 * 2 ** retries.current++, 30_000))
        },
      )
      .finally(() => setWrites((n) => n - 1))
  }

  /** Sends the newest unsaved document again, now. */
  function retry() {
    const newest = unsaved.current.at(-1)
    if (newest && mounted.current) write(newest.data)
  }

  /** Leaving anyway: what didn't save is dropped. */
  function discard() {
    clearTimeout(retryTimer.current)
    retryTimer.current = undefined
    settle(unsaved.current.length, false)
  }

  /** A document waiting out its backoff goes now. */
  const retryNow = useEffectEvent(() => {
    if (retryTimer.current !== undefined) retry()
  })
  useEffect(() => {
    mounted.current = true
    const online = () => retryNow()
    window.addEventListener('online', online)
    return () => {
      window.removeEventListener('online', online)
      // One last try on the way out. This cleanup runs before the editor's
      // (parents first), so the write its unmount flush sends sees mounted false.
      retryNow()
      mounted.current = false
      clearTimeout(retryTimer.current)
    }
  }, [])

  // The editors write after a second of quiet. A long burst of drawing still
  // goes out every 5 s, and what's waiting goes when the tab is hidden: a
  // phone can discard a hidden tab without unloading it.
  useEffect(() => {
    const flush = () => editor.current?.flush()
    const flushIfHidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    const timer = setInterval(flush, 5000)
    document.addEventListener('visibilitychange', flushIfHidden)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', flushIfHidden)
    }
  }, [])

  // Leaving with changes that aren't in Postgres asks first. The change still
  // in the debounce and a document waiting out its backoff go now, and the
  // writes on their way are waited for.
  const blocker = useBlocker({
    shouldBlockFn: async () => {
      editor.current?.flush()
      if (retryTimer.current !== undefined) retry()
      await writeQueues.get(row.id)?.done
      return unsaved.current.length > 0
    },
    // Closing or reloading the tab cuts a write off, so the browser asks.
    enableBeforeUnload: () => {
      editor.current?.flush()
      return unsaved.current.length > 0
    },
    withResolver: true,
  })

  // Drawings autosave, so Mod+S only writes a pending change now; without this
  // the browser opens "Save page as". Keys pressed inside draw.io's iframe go
  // to draw.io, whose own Mod+S also saves. Mod combos fire in text fields too.
  useHotkey('Mod+S', () => editor.current?.flush())

  // The drawing as it stands; before the editor has loaded, as it was loaded.
  const current = () => editor.current?.getData() ?? doc ?? emptyData(row.kind)

  async function exportPng() {
    try {
      if (!editor.current) throw new Error('The editor is still loading.')
      if (isEmptyDrawing(current())) throw new Error('The drawing is empty.')
      downloadBlob(await editor.current.exportPng(), `${fileName(name)}.png`)
    } catch (error) {
      toast.add({ title: 'PNG not exported', description: (error as Error).message, type: 'error' })
    }
  }

  function exportNativeFile() {
    const file = toNativeFile(row.kind, name, current())
    downloadBlob(file, file.name)
  }

  // Asked for when the import would overwrite something.
  const [replacement, setReplacement] = useState<{ fileName: string; data: CanvasData } | null>(null)
  const [confirming, setConfirming] = useState(false)

  async function pickFile(file: File) {
    let data: CanvasData
    try {
      const imported = await readCanvasFile(file)
      assertSameKind(imported.kind, row.kind)
      // A whiteboard Excalidraw can't load fails here, before it replaces anything.
      data =
        imported.kind === 'whiteboard'
          ? (await loadEditor.whiteboard()).normalizeWhiteboard(imported.data as WhiteboardData)
          : imported.data
    } catch (error) {
      toast.add({ title: 'Import failed', description: (error as Error).message, type: 'error' })
      return
    }
    if (isEmptyDrawing(current())) {
      replaceWith(data)
    } else {
      setReplacement({ fileName: file.name, data })
      setConfirming(true)
    }
  }

  function replaceWith(data: CanvasData) {
    editor.current?.flush() // a stroke still waiting goes first (or the import takes its place in the queue),
    save(data) // then the import, through the same queue
    setDoc(data)
    setVersion((v) => v + 1) // remount the editor on the imported document
  }

  const failed = writes === 0 && saveState === 'failed'
  const status =
    failed ? 'Not saved' : dirty || writes > 0 ? 'Saving…' : saveState === 'saved' ? 'Saved' : null

  return (
    <div className="flex h-svh flex-col">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <SidebarTrigger className="-ml-1 md:hidden" />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-sm text-muted-foreground max-sm:hidden">Drawings /</span>
          <h1 ref={heading} tabIndex={-1} className="min-w-0 truncate font-semibold outline-none">
            {name}
          </h1>
          <Badge variant="secondary" className="max-sm:hidden">
            <KindIcon data-icon="inline-start" />
            {kindLabels[row.kind]}
          </Badge>
          <span
            role="status"
            className={cn('shrink-0 text-xs text-muted-foreground', failed && 'text-destructive')}
          >
            {status}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <DownloadIcon data-icon="inline-start" />
            Export
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => void exportPng()}>
                <ImageIcon />
                PNG image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportNativeFile}>
                <FileCodeIcon />
                {row.kind === 'whiteboard' ? '.excalidraw file' : '.drawio file'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadBundle(row.kind, name, current())}>
                <FileJsonIcon />
                DoIT JSON
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
          <UploadIcon data-icon="inline-start" />
          Import
        </Button>
        <input
          ref={fileInput}
          type="file"
          hidden
          accept=".json,.excalidraw,.drawio,.xml"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void pickFile(file)
            e.target.value = ''
          }}
        />
        {canvas ? <CanvasMenu canvas={canvas} /> : null}
      </header>

      <div className="min-h-0 flex-1">
        <Suspense fallback={<EditorLoading />}>
          {row.kind === 'whiteboard' ? (
            <ExcalidrawEditor
              key={version}
              ref={editor}
              name={name}
              initialData={doc as WhiteboardData | null}
              dark={dark}
              onSave={save}
              onDirty={() => setDirty(true)}
            />
          ) : (
            <DrawioEditor
              key={version}
              ref={editor}
              name={name}
              initialData={doc as DiagramData | null}
              dark={dark}
              onSave={save}
              onDirty={() => setDirty(true)}
              onLeave={() => heading.current?.focus()}
            />
          )}
        </Suspense>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Replace “{name}” with “{replacement?.fileName}”?
            </AlertDialogTitle>
            <AlertDialogDescription>The current drawing is overwritten.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (replacement) replaceWith(replacement.data)
                setConfirming(false)
              }}
            >
              Replace drawing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={blocker.status === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              The latest changes to “{name}” aren’t saved yet. Stay and DoIT keeps trying, or export
              the drawing before you leave.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                discard()
                blocker.proceed?.()
              }}
            >
              Leave anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function EditorLoading() {
  return (
    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
      <Spinner />
      Loading the editor…
    </div>
  )
}
