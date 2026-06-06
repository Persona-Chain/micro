import { z } from "zod"

const urlOpt = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || /^https?:\/\//i.test(v), { message: "Must be a valid URL (http/https)" })

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().max(50).optional(),
    bio: z.string().trim().max(500).optional(),
    location: z.string().trim().max(80).optional(),
    website: urlOpt,
    github: z.string().trim().max(100).optional(),
    twitter: z.string().trim().max(100).optional(),
  })
  .strict()

export const createPortfolioSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(1000).optional(),
    imageUrl: urlOpt,
    projectUrl: urlOpt,
  })
  .strict()

export const updatePortfolioSchema = createPortfolioSchema.partial().strict()

export const createReviewSchema = z
  .object({
    taskId: z.number().int().positive(),
    targetUsername: z.string().trim().min(1).max(60),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(2000).optional(),
  })
  .strict()

