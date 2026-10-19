// Row shapes as Supabase returns them: snake_case, dates as ISO strings.
// Keeping strings (no Date transforms) means a row reads and writes the same
// way, which TanStack DB's update drafts need.
import { z } from 'zod'

export const labelColors = [
  'blue',
  'purple',
  'teal',
  'red',
  'amber',
  'green',
  'gray',
] as const
export type LabelColor = (typeof labelColors)[number]

export const priorities = ['low', 'medium', 'high', 'urgent'] as const
export type Priority = (typeof priorities)[number]

const id = z.string().uuid()
const timestamp = z.string()
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const color = z.enum(labelColors)

export const boardSchema = z.object({
  id,
  owner_id: id,
  name: z.string().trim().min(1).max(80),
  key: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9]{0,5}$/),
  color,
  position: z.number(),
  next_number: z.number().int(),
  archived_at: timestamp.nullable(),
  created_at: timestamp,
})
export type Board = z.infer<typeof boardSchema>

export const columnSchema = z.object({
  id,
  owner_id: id,
  board_id: id,
  name: z.string().trim().min(1).max(60),
  color,
  position: z.number(),
  wip_limit: z.number().int().positive().nullable(),
  is_done: z.boolean(),
  created_at: timestamp,
})
export type Column = z.infer<typeof columnSchema>

export const sprintStates = ['planned', 'active', 'closed'] as const
export type SprintState = (typeof sprintStates)[number]

export const sprintSchema = z.object({
  id,
  owner_id: id,
  board_id: id,
  name: z.string().trim().min(1).max(60),
  goal: z.string().max(500),
  starts_on: day,
  ends_on: day,
  state: z.enum(sprintStates),
  closed_at: timestamp.nullable(),
  created_at: timestamp,
})
export type Sprint = z.infer<typeof sprintSchema>

export const labelSchema = z.object({
  id,
  owner_id: id,
  board_id: id,
  name: z.string().trim().min(1).max(30),
  color,
  created_at: timestamp,
})
export type Label = z.infer<typeof labelSchema>

export const cardSchema = z.object({
  id,
  owner_id: id,
  board_id: id,
  column_id: id,
  sprint_id: id.nullable(),
  number: z.number().int(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(20_000),
  priority: z.enum(priorities),
  due_on: day.nullable(),
  label_ids: z.array(id),
  position: z.number(),
  backlog_position: z.number(),
  completed_at: timestamp.nullable(),
  created_at: timestamp,
  updated_at: timestamp,
})
export type Card = z.infer<typeof cardSchema>

export const checklistItemSchema = z.object({
  id,
  owner_id: id,
  card_id: id,
  text: z.string().trim().min(1).max(300),
  done: z.boolean(),
  position: z.number(),
  created_at: timestamp,
})
export type ChecklistItem = z.infer<typeof checklistItemSchema>

export const cardEventSchema = z.object({
  id,
  owner_id: id,
  card_id: id,
  kind: z.string(),
  body: z.string().max(5_000),
  created_at: timestamp,
})
export type CardEvent = z.infer<typeof cardEventSchema>

export const todoSectionSchema = z.object({
  id,
  owner_id: id,
  name: z.string().trim().min(1).max(60),
  position: z.number(),
  created_at: timestamp,
})
export type TodoSection = z.infer<typeof todoSectionSchema>

export const todoSchema = z.object({
  id,
  owner_id: id,
  // Null is the inbox.
  section_id: id.nullable(),
  text: z.string().trim().min(1).max(300),
  done: z.boolean(),
  due_on: day.nullable(),
  position: z.number(),
  created_at: timestamp,
})
export type Todo = z.infer<typeof todoSchema>

export const canvasKinds = ['whiteboard', 'diagram'] as const
export type CanvasKind = (typeof canvasKinds)[number]

// The list entry only: the drawing (`data`) is loaded by the editor.
export const canvasSchema = z.object({
  id,
  owner_id: id,
  name: z.string().trim().min(1).max(80),
  kind: z.enum(canvasKinds),
  position: z.number(),
  created_at: timestamp,
  updated_at: timestamp,
})
export type Canvas = z.infer<typeof canvasSchema>
