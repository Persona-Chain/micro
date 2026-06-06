import { proxyBountyBeeRequest } from "@/lib/server/bountybee-proxy"

export const runtime = "nodejs"

export async function GET(req: Request, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params
  return proxyBountyBeeRequest(req, `/api/v1/profile/${encodeURIComponent(username)}/stats`)
}
