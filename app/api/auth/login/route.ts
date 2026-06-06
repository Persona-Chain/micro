import { NextResponse } from "next/server"
import { jsonError, normalizeError } from "@/lib/server/http"
import { rateLimit, getClientIp } from "@/lib/server/rate-limit"
import { loginSchema } from "@/lib/server/validation"
import { setAuthCookie, setExternalAuthCookie, signJwt } from "@/lib/server/auth"
import { loginWithExternalAuth } from "@/lib/server/external-auth"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req.headers)
    const rl = rateLimit(`auth:login:${ip}`, { limit: 20, windowMs: 60_000 })
    if (!rl.ok) return jsonError("Too many requests", 429)

    const body = loginSchema.parse(await req.json())
    const email = body.email.toLowerCase()

    const { external, user } = await loginWithExternalAuth({
      email,
      password: body.password,
    })

    const token = signJwt(user.id)
    const res = NextResponse.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, email: user.email },
    })
    setAuthCookie(res, token)
    if (!external.token) throw new Error("External auth did not return a session token")
    setExternalAuthCookie(res, external.token, external.token_ttl_seconds)
    return res
  } catch (e) {
    return normalizeError(e)
  }
}
