import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { EXTERNAL_AUTH_COOKIE_NAME } from "@/lib/server/auth"

type ProxyOptions = {
  auth?: boolean
  service?: boolean
}

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
  return req.arrayBuffer()
}

export async function proxyBountyBeeRequest(req: Request, path: string, options: ProxyOptions = {}) {
  const { baseUrl, serviceKey } = getBountyBeeProxyConfig()
  const sourceUrl = new URL(req.url)
  const targetUrl = new URL(`${baseUrl}${path}`)
  targetUrl.search = sourceUrl.search

  const headers: Record<string, string> = {}
  const requestContentType = req.headers.get("content-type")
  if (requestContentType) headers["Content-Type"] = requestContentType

  if (options.auth) {
    const token = (await cookies()).get(EXTERNAL_AUTH_COOKIE_NAME)?.value || null
    if (!token) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }
    headers.Authorization = `Bearer ${token}`
  }

  if (options.service) {
    if (!serviceKey) {
      return NextResponse.json({ success: false, message: "Missing service key" }, { status: 500 })
    }
    headers["X-Service-Key"] = serviceKey
  }

  const res = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: await readBody(req),
    cache: "no-store",
  })

  const text = await res.text()
  const responseContentType = res.headers.get("content-type") || "application/json"

  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": responseContentType,
    },
  })
}
