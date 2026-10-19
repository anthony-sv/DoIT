// What the drawing page, the sidebar, the menus and the command palette
// share: labels, icons, the name rule, and which drawings this tab deleted.
import { type LucideIcon, PenToolIcon, WorkflowIcon } from 'lucide-react'
import { z } from 'zod'
import type { CanvasKind } from '@/data/schemas'

export const kindLabels: Record<CanvasKind, string> = {
  whiteboard: 'Whiteboard',
  diagram: 'Diagram',
}

export const kindIcons: Record<CanvasKind, LucideIcon> = {
  whiteboard: PenToolIcon,
  diagram: WorkflowIcon,
}

export const canvasNameSchema = z.string().trim().min(1, 'Give the drawing a name').max(80)

/**
 * Drawings deleted from this tab. Leaving the page flushes its last change and
 * a write can still be on its way, so for these ids a write that finds no row
 * is expected, not a failure.
 */
export const deletedHere = new Set<string>()
