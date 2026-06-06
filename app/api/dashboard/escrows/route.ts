import { proxyBountyBeeRequest } from "@/lib/server/bountybee-proxy"

export const runtime = "nodejs"

export async function GET(req: Request) {
  return proxyBountyBeeRequest(req, "/api/v1/dashboard/escrows", { auth: true })
}
