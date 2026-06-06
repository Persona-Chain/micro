import { proxyBountyBeeRequest } from "@/lib/server/bountybee-proxy"

export const runtime = "nodejs"

export async function PUT(req: Request, ctx: { params: Promise<{ id: string; step: string }> }) {
  const { id, step } = await ctx.params
  return proxyBountyBeeRequest(req, `/api/v1/tasks/${encodeURIComponent(id)}/step/${encodeURIComponent(step)}`, {
    auth: true,
  })
}
