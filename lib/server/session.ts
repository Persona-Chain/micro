import { cookies } from "next/headers"
import { BountyBeeApiError, getExternalCurrentUser } from "@/lib/server/bountybee-api"
import { AUTH_COOKIE_NAME, EXTERNAL_AUTH_COOKIE_NAME, verifyJwtToken } from "@/lib/server/auth"

export async function requireCurrentUser() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value || null
  const externalToken = (await cookies()).get(EXTERNAL_AUTH_COOKIE_NAME)?.value || null
  if (!token) return null
  const payload = verifyJwtToken(token)
  if (!payload) return null

  const userId = Number(payload.sub)
  if (!Number.isFinite(userId)) return null

  if (!externalToken) return null
  let user = null
  try {
    user = await getExternalCurrentUser(externalToken)
  } catch (error) {
    if (error instanceof BountyBeeApiError && error.status === 401) return null
    throw error
  }

  if (!user || user.id !== userId) return null
  return { id: user.id, username: user.username, email: user.email }
}
