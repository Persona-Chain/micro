import { cookies } from "next/headers"
import { getExternalCurrentUser } from "@/lib/server/bountybee-api"
import { AUTH_COOKIE_NAME, EXTERNAL_AUTH_COOKIE_NAME, verifyJwtToken } from "@/lib/server/auth"
import { jsonError, jsonOk } from "@/lib/server/http"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value || null
  const externalToken = (await cookies()).get(EXTERNAL_AUTH_COOKIE_NAME)?.value || null
  if (!token) return jsonError("Unauthorized", 401)
  if (!externalToken) return jsonError("Unauthorized", 401)

  const payload = verifyJwtToken(token)
  if (!payload) return jsonError("Unauthorized", 401)

  const userId = Number(payload.sub)
  if (!Number.isFinite(userId)) return jsonError("Unauthorized", 401)

  const user = await getExternalCurrentUser(externalToken)
  if (!user || user.id !== userId) return jsonError("Unauthorized", 401)

  return jsonOk({
    success: true,
    user: {
      ...user,
      emailVerified: true,
    },
  })
}
