import { NextResponse } from "next/server"
import { proxyBountyBeeRequest } from "@/lib/server/bountybee-proxy"
import { getExternalAuthToken, getExternalBsvAddress } from "@/lib/server/external-wallets"
import { getConfirmedBalance, getUnconfirmedBalance } from "@/lib/server/whatsonchain"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const token = await getExternalAuthToken()
  if (!token) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  let input: Record<string, unknown> = {}
  try {
    input = (await req.json()) as Record<string, unknown>
  } catch {
    input = {}
  }

  let address = typeof input.address === "string" ? input.address : null
  if (!address) {
    address = await getExternalBsvAddress(token)
  }

  const body: Record<string, unknown> = { ...input }
  if (address) {
    const [confirmed, unconfirmed] = await Promise.all([
      getConfirmedBalance(address),
      getUnconfirmedBalance(address),
    ])

    body.availableBalance = confirmed.confirmed
    body.confirmedBalance = confirmed.confirmed
    body.pendingBalance = unconfirmed.unconfirmed
    body.unconfirmedBalance = unconfirmed.unconfirmed
  }

  return proxyBountyBeeRequest(
    new Request(req.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    "/api/v1/wallet/sync",
    { auth: true },
  )
}
