type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

type ApiRequestOptions = {
  method?: ApiMethod
  token?: string | null
  service?: boolean
  body?: unknown
  query?: Record<string, string | number | boolean | null | undefined>
}

export type ExternalBountyBeeUser = {
  id: number
  email: string
  username: string
  displayName?: string | null
  avatarUrl?: string | null
}

export type ExternalUsersMeResponse = {
  user?: ExternalBountyBeeUser
  wallet?: {
    address?: string | null
    availableBalance?: number
    pendingBalance?: number
    reservedBalance?: number
  }
}

export class BountyBeeApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "BountyBeeApiError"
    this.status = status
  }
}

function getBountyBeeApiConfig() {
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

function withQuery(url: string, query?: ApiRequestOptions["query"]) {
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

export async function bountyBeeApiFetch<T = unknown>(path: string, options: ApiRequestOptions = {}) {
  const { baseUrl, serviceKey } = getBountyBeeApiConfig()
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  }

  if (options.token) headers.Authorization = `Bearer ${options.token}`
  if (options.service || serviceKey) {
    if (!serviceKey) throw new Error("Missing AUTH_SERVICE_KEY or BOUNTYBEE_SERVICE_KEY in environment")
    headers["X-Service-Key"] = serviceKey
  }

  const res = await fetch(withQuery(`${baseUrl}${path}`, options.query), {
    method: options.method || (options.body === undefined ? "GET" : "POST"),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  })

  const data = (await res.json().catch(() => null)) as any
  if (!res.ok || data?.success === false) {
    throw new BountyBeeApiError(data?.message || `BountyBee API request failed: ${path}`, res.status)
  }
  return data as T
}

export async function getExternalCurrentUser(token: string) {
  const data = await bountyBeeApiFetch<ExternalUsersMeResponse>("/api/v1/users/me", { token })
  return data.user || null
}
