import { NextResponse } from "next/server"
import { ZodError } from "zod"

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = "HttpError"
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 200, ...init })
}

export function jsonError(message: string, status: number = 400, details?: unknown) {
  return NextResponse.json(
    { success: false, message, details: details ?? undefined },
    { status },
  )
}

export function normalizeError(e: unknown) {
  if (e instanceof ZodError) {
    return jsonError("Validation error", 422, e.flatten())
  }
  if (e instanceof HttpError) {
    return jsonError(e.message, e.status)
  }
  console.error(e)
  const message = e instanceof Error ? e.message : "Internal server error"
  if (process.env.NODE_ENV !== "production") {
    return jsonError(message || "Internal server error", 500)
  }
  return jsonError("Internal server error", 500)
}
