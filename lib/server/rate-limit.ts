type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, opts: { limit: number; windowMs: number }) {
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs })
    return { ok: true, remaining: opts.limit - 1, resetAt: now + opts.windowMs }
  }

  if (existing.count >= opts.limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt }
  }

  existing.count += 1
  return { ok: true, remaining: opts.limit - existing.count, resetAt: existing.resetAt }
}

export function getClientIp(headers: Headers) {
  const xfwd = headers.get("x-forwarded-for")
  if (xfwd) return xfwd.split(",")[0]?.trim() || "unknown"
  return headers.get("x-real-ip") || "unknown"
}

