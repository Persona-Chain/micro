import { z } from "zod"

export const submitWorkSchema = z
  .object({
    message: z.string().trim().min(10, "Please write at least 10 characters").max(4000),
  })
  .strict()

export const approveSubmissionSchema = z
  .object({
    submissionId: z.number().int().positive(),
  })
  .strict()

