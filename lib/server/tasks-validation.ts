import { z } from "zod"

export const createDraftSchema = z.object({}).strict()

export const step1Schema = z.object({
  title: z.string().trim().min(10, "Title must be at least 10 characters").max(120),
  shortDescription: z.string().trim().min(10).max(280),
  // Accept both numbers and numeric strings from forms.
  categoryId: z.coerce.number().int().positive(),
  tags: z.array(z.string().trim().min(1).max(32)).max(20).default([]),
})

export const step2Schema = z.object({
  fullDescription: z.string().trim().min(20),
  requirements: z.string().trim().min(10),
  instructions: z.string().trim().min(0).optional().default(""),
})

export const step3Schema = z.object({
  rewardAmount: z.number().int().positive(),
  currency: z.literal("BSV").default("BSV"),
  maxWorkers: z.number().int().positive().max(1000),
  estimatedCompletionTime: z.number().int().positive().max(60 * 24 * 30).optional(),
})

export const step4Schema = z.object({
  // Accept both full ISO strings and date-only strings; we'll validate in parseFutureDate.
  expirationDate: z.string().optional(),
  visibility: z.enum(["public", "unlisted", "private"]).default("public"),
  featuredTask: z.boolean().default(false),
  autoApprove: z.boolean().default(false),
})

export function parseFutureDate(dateStr?: string) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) throw new Error("Invalid expirationDate")
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  if (d.getTime() < todayStart.getTime()) throw new Error("expirationDate must be today or in the future")
  return d
}
