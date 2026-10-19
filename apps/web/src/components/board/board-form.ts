import { z } from 'zod'
import { labelColors } from '@/data/schemas'

// The same rules for a new board and for editing one.
export const boardFormSchema = z.object({
  name: z.string().trim().min(1, 'Give the board a name').max(80),
  key: z
    .string()
    .regex(/^[A-Z][A-Z0-9]{0,5}$/, '1–6 capital letters or digits, starting with a letter'),
  color: z.enum(labelColors),
})
