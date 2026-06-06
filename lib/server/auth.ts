import type { NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { getJwtSecret } from "./env"

export const AUTH_COOKIE_NAME = "auth_token"
export const EXTERNAL_AUTH_COOKIE_NAME = "external_auth_token"

type JwtPayload = {
  sub: string
}

export function signJwt(userId: number) {
  return jwt.sign({ sub: String(userId) } satisfies JwtPayload, getJwtSecret(), {
    expiresIn: "7d",
  })
}

export function verifyJwtToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret())
    if (!decoded || typeof decoded !== "object") return null
    if (typeof (decoded as any).sub !== "string") return null
    return decoded as JwtPayload
  } catch {
    return null
  }
}

export function getTokenFromRequest(req: NextRequest) {
  return req.cookies.get(AUTH_COOKIE_NAME)?.value || null
}

export function setAuthCookie(res: NextResponse, token: string) {
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
}

export function setExternalAuthCookie(res: NextResponse, token: string, maxAgeSeconds = 60 * 60 * 24 * 7) {
  res.cookies.set(EXTERNAL_AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  })
}

export function clearAuthCookie(res: NextResponse) {
  res.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
  res.cookies.set(EXTERNAL_AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}
