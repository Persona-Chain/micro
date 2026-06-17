import { NextResponse } from "next/server"
import { bountyBeeApiFetch } from "@/lib/server/bountybee-api"
import { getExternalAuthToken, getExternalBsvAddress } from "@/lib/server/external-wallets"

export const runtime = "nodejs"

export async function GET() {
  const token = await getExternalAuthToken()
  if (!token) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const [wallet, address] = await Promise.all([
    bountyBeeApiFetch<Record<string, unknown>>("/api/v1/wallet", { token }),
    getExternalBsvAddress(token),
  ])

  return NextResponse.json({
    ...wallet,
    address: address || wallet.address || null,
  })
}
