import { proxyBountyBeeRequest } from "@/lib/server/bountybee-proxy"

export const runtime = "nodejs"

export async function POST(req: Request) {
  return proxyBountyBeeRequest(req, "/api/v1/profile/avatar", { auth: true })
}

export async function DELETE(req: Request) {
  return proxyBountyBeeRequest(req, "/api/v1/profile/avatar", { auth: true })
}
