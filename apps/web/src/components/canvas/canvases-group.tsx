import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { PlusIcon, UploadIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { toast } from '@/components/ui/toast'
import { canvasesCollection } from '@/data/collections'
import { type CanvasKind, canvasKinds } from '@/data/schemas'
import { positionAfterLast } from '@/lib/position'
import { supabase } from '@/lib/supabase'
import { type WhiteboardData, readCanvasFile } from './canvas-file'
import { CanvasMenu } from './canvas-menu'
import { kindIcons, kindLabels } from './canvas-ui'
import { NewCanvasDialog } from './new-canvas-dialog'

// The whiteboard editor's chunk, which the import opens next anyway. Behind
// import.meta.env.SSR like the canvas route, so the server bundle drops it.
const loadWhiteboard = () =>
  import.meta.env.SSR
    ? Promise.reject(new Error('Whiteboards only load in the browser.'))
    : import('./excalidraw-editor')

/** A file as a new drawing of whatever kind it holds. Resolves to its id. */
async function importAsNewCanvas(file: File) {
  const read = await readCanvasFile(file)
  const { kind, name } = read
  // A whiteboard Excalidraw can't load fails here, before anything is stored.
  const data =
    kind === 'whiteboard'
      ? (await loadWhiteboard()).normalizeWhiteboard(read.data as WhiteboardData)
      : read.data
  const id = crypto.randomUUID()
  const position = positionAfterLast(
    canvasesCollection.toArray.map((c) => c.position).sort((a, b) => a - b),
  )
  // Straight to Postgres: the collection never sends `data`, so it learns
  // about the row from a refetch.
  const { error } = await supabase.from('canvases').insert({ id, name, kind, position, data })
  if (error) throw new Error(error.message)
  await canvasesCollection.utils.refetch()
  return { id, name }
}

// Sidebar list of whiteboards and diagrams, with new and import.
export function CanvasesGroup() {
  const navigate = useNavigate()
  const { canvasId } = useParams({ strict: false })
  const fileInput = useRef<HTMLInputElement>(null)
  const [creating, setCreating] = useState(false)
  const [newKind, setNewKind] = useState<CanvasKind>('whiteboard')

  const { data: canvases } = useLiveQuery({
    query: (q) => q.from({ canvas: canvasesCollection }).orderBy(({ canvas }) => canvas.position),
  })

  function create(kind: CanvasKind) {
    setNewKind(kind)
    setCreating(true)
  }

  async function importFile(file: File) {
    try {
      const { id } = await toast.promise(importAsNewCanvas(file), {
        loading: { title: `Importing ${file.name}…` },
        success: ({ name }) => ({ title: 'Drawing imported', description: name }),
        error: (error: Error) => ({ title: 'Import failed', description: error.message }),
      })
      void navigate({ to: '/c/$canvasId', params: { canvasId: id } })
    } catch {
      // The toast already says what went wrong.
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Drawings</SidebarGroupLabel>
      <DropdownMenu>
        <DropdownMenuTrigger render={<SidebarGroupAction title="New drawing" />}>
          <PlusIcon />
          <span className="sr-only">New drawing</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            {canvasKinds.map((kind) => {
              const Icon = kindIcons[kind]
              return (
                <DropdownMenuItem key={kind} onClick={() => create(kind)}>
                  <Icon />
                  New {kindLabels[kind].toLowerCase()}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => fileInput.current?.click()}>
              <UploadIcon />
              Import file…
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileInput}
        type="file"
        hidden
        accept=".json,.excalidraw,.drawio,.xml"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void importFile(file)
          e.target.value = ''
        }}
      />
      <SidebarGroupContent>
        <SidebarMenu>
          {canvases.map((canvas) => {
            const Icon = kindIcons[canvas.kind]
            return (
              <SidebarMenuItem key={canvas.id}>
                <SidebarMenuButton
                  isActive={canvas.id === canvasId}
                  render={<Link to="/c/$canvasId" params={{ canvasId: canvas.id }} />}
                >
                  <Icon />
                  <span className="truncate">{canvas.name}</span>
                </SidebarMenuButton>
                <CanvasMenu canvas={canvas} trigger={<SidebarMenuAction showOnHover />} />
              </SidebarMenuItem>
            )
          })}
          {canvases.length === 0 ? (
            <SidebarMenuItem>
              <SidebarMenuButton className="text-muted-foreground" onClick={() => create('whiteboard')}>
                <PlusIcon />
                New drawing
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
        </SidebarMenu>
      </SidebarGroupContent>

      <NewCanvasDialog open={creating} onOpenChange={setCreating} kind={newKind} />
    </SidebarGroup>
  )
}
