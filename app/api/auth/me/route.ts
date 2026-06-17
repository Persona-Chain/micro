import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { BountyBeeApiError, getExternalCurrentUser } from "@/lib/server/bountybee-api"
import { AUTH_COOKIE_NAME, EXTERNAL_AUTH_COOKIE_NAME, clearAuthCookie, verifyJwtToken } from "@/lib/server/auth"
import { getExternalBsvAddress } from "@/lib/server/external-wallets"
import { jsonError, jsonOk } from "@/lib/server/http"

export const runtime = "nodejs"

export async function GET() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value || null
  const externalToken = (await cookies()).get(EXTERNAL_AUTH_COOKIE_NAME)?.value || null
  if (!token) return jsonError("Unauthorized", 401)
  if (!externalToken) {
    const res = NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    clearAuthCookie(res)
    return res
  }

  const payload = verifyJwtToken(token)
  if (!payload) {
    const res = NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    clearAuthCookie(res)
    return res
  }

  const userId = Number(payload.sub)
  if (!Number.isFinite(userId)) return jsonError("Unauthorized", 401)

  let user = null
  try {
    user = await getExternalCurrentUser(externalToken)
  } catch (error) {
    if (error instanceof BountyBeeApiError && error.status === 401) {
      const res = NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
      clearAuthCookie(res)
      return res
    }
    throw error
  }

  if (!user || user.id !== userId) return jsonError("Unauthorized", 401)

  const address = await getExternalBsvAddress(externalToken)

  return jsonOk({
    success: true,
    address,
    user: {
      ...user,
      address,
      emailVerified: true,
    },
  })
}
