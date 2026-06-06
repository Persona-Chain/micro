import { z } from "zod"

export const openDisputeSchema = z
  .object({
    escrowId: z.number().int().positive(),
    reason: z.string().trim().min(10).max(2000),
  })
  .strict()

export const addDisputeCommentSchema = z
  .object({
    message: z.string().trim().min(1).max(2000),
  })
  .strict()

