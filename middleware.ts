import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifyRequestAuthToken } from "@/lib/edge/auth"

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()

  // Allow public auth pages even if they live under protected folders later.
  if (
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/register") ||
    url.pathname.startsWith("/forgot-password") ||
    url.pathname.startsWith("/reset-password") ||
    url.pathname.startsWith("/verify-email")
  ) {
    return NextResponse.next()
  }

  const auth = await verifyRequestAuthToken(request)
  if (!auth) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.searchParams.set("next", url.pathname + url.search)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/wallet/:path*', '/settings/:path*', '/messages/:path*'],
}
