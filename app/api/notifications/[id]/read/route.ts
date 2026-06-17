import { proxyBountyBeeRequest } from "@/lib/server/bountybee-proxy"

export const runtime = "nodejs"

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return proxyBountyBeeRequest(req, `/api/v1/notifications/${encodeURIComponent(id)}/read`, { auth: true })
}
