import { proxyBountyBeeRequest } from "@/lib/server/bountybee-proxy"

export const runtime = "nodejs"

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return proxyBountyBeeRequest(req, `/api/v1/tasks/${encodeURIComponent(id)}`, { auth: true })
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return proxyBountyBeeRequest(req, `/api/v1/tasks/${encodeURIComponent(id)}`, { auth: true })
}
