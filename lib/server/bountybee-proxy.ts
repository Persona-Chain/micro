import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { clearAuthCookie, EXTERNAL_AUTH_COOKIE_NAME } from "@/lib/server/auth"

type ProxyOptions = {
  auth?: boolean
  service?: boolean
}

const MAX_PROXY_BODY_BYTES = 1024 * 1024

function getBountyBeeProxyConfig() {
  const baseUrl = (
    process.env.BOUNTYBEE_API_URL ||
    process.env.AUTH_API_URL ||
    process.env.WALLET_API_URL ||
    ""
  ).replace(/\/+$/, "")
  const serviceKey = process.env.AUTH_SERVICE_KEY || process.env.BOUNTYBEE_SERVICE_KEY || ""
  if (!baseUrl) throw new Error("Missing BOUNTYBEE_API_URL or AUTH_API_URL in environment")
  return { baseUrl, serviceKey }
}

async function readBody(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return undefined
  const contentLength = Number(req.headers.get("content-length") || 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_PROXY_BODY_BYTES) {
    throw Object.assign(new Error("Request body too large"), { status: 413 })
  }
  const text = await req.text()
  if (text.length > MAX_PROXY_BODY_BYTES) {
    throw Object.assign(new Error("Request body too large"), { status: 413 })
  }
  return text
}

export async function proxyBountyBeeRequest(req: Request, path: string, options: ProxyOptions = {}) {
  let config: ReturnType<typeof getBountyBeeProxyConfig>
  try {
    config = getBountyBeeProxyConfig()
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Wallet backend is not configured",
      },
      { status: 500 },
    )
  }

  const { baseUrl, serviceKey } = config
  const sourceUrl = new URL(req.url)
  const targetUrl = new URL(`${baseUrl}${path}`)
  targetUrl.search = sourceUrl.search

  const headers: Record<string, string> = {
    Accept: "application/json",
  }
  const requestContentType = req.headers.get("content-type")
  if (requestContentType) headers["Content-Type"] = requestContentType

  if (options.auth) {
    const token = (await cookies()).get(EXTERNAL_AUTH_COOKIE_NAME)?.value || null
    if (!token) {
      const response = NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
      clearAuthCookie(response)
      return response
    }
    headers.Authorization = `Bearer ${token}`
  }

  if (options.service || serviceKey) {
    if (!serviceKey) {
      return NextResponse.json({ success: false, message: "Missing service key" }, { status: 500 })
    }
    headers["X-Service-Key"] = serviceKey
  }

  let body: string | undefined
  try {
    body = await readBody(req)
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Invalid request body",
      },
      { status: Number(error?.status) || 400 },
    )
  }

  let res: Response
  try {
    res = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
    })
  } catch {
    return NextResponse.json(
      { success: false, message: "Wallet backend request failed" },
      { status: 502 },
    )
  }

  const text = await res.text()
  const responseContentType = res.headers.get("content-type") || "application/json"

  const response = new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": responseContentType,
    },
  })

  if (options.auth && res.status === 401) {
    clearAuthCookie(response)
  }

  return response
}
