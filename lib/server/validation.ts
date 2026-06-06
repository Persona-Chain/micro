import { z } from "zod"

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(32)
    .regex(/^[a-zA-Z0-9._-]+$/, "Username can only use letters, numbers, dots, dashes, and underscores"),
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
})

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(1, "Password is required").max(200),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email"),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "Invalid token").max(500),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
})
