import { z } from "zod"

export const withdrawSchema = z.object({
  address: z.string().trim().min(3).max(120),
  amount: z.number().int().positive(),
})
