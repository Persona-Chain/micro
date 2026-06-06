import { jwtVerify } from "jose"

const AUTH_COOKIE_NAME = "auth_token"

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) return null
  return new TextEncoder().encode(secret)
}

export async function verifyRequestAuthToken(request: Request) {
  const cookie = request.headers.get("cookie") || ""
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${AUTH_COOKIE_NAME}=([^;]+)`))
  const token = match ? decodeURIComponent(match[1]) : null
  if (!token) return null

  const secret = getSecret()
  if (!secret) return null

  try {
    const { payload } = await jwtVerify(token, secret)
    const sub = payload.sub
    if (typeof sub !== "string") return null
    const userId = Number(sub)
    if (!Number.isFinite(userId)) return null
    return { userId }
  } catch {
    return null
  }
}
