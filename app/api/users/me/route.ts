import { proxyBountyBeeRequest } from "@/lib/server/bountybee-proxy"

export const runtime = "nodejs"

export async function GET(req: Request) {
  return proxyBountyBeeRequest(req, "/api/v1/users/me", { auth: true })
}

export async function PATCH(req: Request) {
  return proxyBountyBeeRequest(req, "/api/v1/users/me", { auth: true })
}
