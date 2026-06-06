import { proxyBountyBeeRequest } from "@/lib/server/bountybee-proxy"

export const runtime = "nodejs"

export async function PATCH(req: Request) {
  return proxyBountyBeeRequest(req, "/api/v1/profile/update", { auth: true })
}
