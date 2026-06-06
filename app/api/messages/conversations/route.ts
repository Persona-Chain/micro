import { proxyBountyBeeRequest } from "@/lib/server/bountybee-proxy"

export const runtime = "nodejs"

export async function GET(req: Request) {
  return proxyBountyBeeRequest(req, "/api/v1/messages/conversations", { auth: true })
}

export async function POST(req: Request) {
  return proxyBountyBeeRequest(req, "/api/v1/messages/conversations", { auth: true })
}
