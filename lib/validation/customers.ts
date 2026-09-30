import { z } from 'zod'
export const customerInput = z.object({ name: z.string().trim().min(2).max(160), phone: z.string().trim().min(6).max(32) })
