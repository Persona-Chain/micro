import { proxyBountyBeeRequest } from "@/lib/server/bountybee-proxy"

export const runtime = "nodejs"

export async function POST(req: Request) {
  return proxyBountyBeeRequest(req, "/api/v1/users/sync", { auth: true })
}
