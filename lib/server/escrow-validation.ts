import { z } from "zod"

export const createEscrowSchema = z
  .object({
    taskId: z.number().int().positive(),
    milestones: z
      .array(
        z.object({
          title: z.string().trim().min(3).max(120),
          description: z.string().trim().max(1000).optional(),
          amount: z.number().int().positive(),
          dueDate: z.string().optional(),
        }),
      )
      .max(50)
      .optional(),
  })
  .strict()

export const fundEscrowSchema = z.object({}).strict()

export const releaseEscrowSchema = z
  .object({
    workerId: z.number().int().positive().optional(),
  })
  .strict()

export const refundEscrowSchema = z.object({}).strict()

export const resolveDisputeSchema = z
  .object({
    winner: z.enum(["worker", "employer", "split"]),
    notes: z.string().trim().max(2000).optional(),
    splitWorkerPercent: z.number().min(0).max(100).optional(),
  })
  .strict()

export function parseOptionalDate(dateStr?: string) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date")
  return d
}

