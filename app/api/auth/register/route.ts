import { randomToken } from "@/lib/server/tokens"
import { getAppUrl } from "@/lib/server/env"
import { jsonError, jsonOk, normalizeError } from "@/lib/server/http"
import { rateLimit, getClientIp } from "@/lib/server/rate-limit"
import { registerSchema } from "@/lib/server/validation"
import { createExternalAuthAccount } from "@/lib/server/external-auth"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req.headers)
    const rl = rateLimit(`auth:register:${ip}`, { limit: 10, windowMs: 60_000 })
    if (!rl.ok) return jsonError("Too many requests", 429)

    const body = registerSchema.parse(await req.json())
    const username = body.username.trim().toLowerCase()

    const verificationToken = randomToken(24)

    await createExternalAuthAccount({
      email: body.email,
      password: body.password,
      username,
    })

    // Email verification temporarily skipped.
    // Keeping token generation here (unused) makes it easy to re-enable later.
    void verificationToken
    void getAppUrl

    return jsonOk({ success: true, message: "Account created successfully" })
  } catch (e) {
    return normalizeError(e)
  }
}
