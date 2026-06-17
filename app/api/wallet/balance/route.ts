import { NextResponse } from "next/server"
import { getExternalAuthToken, getExternalBsvAddress } from "@/lib/server/external-wallets"
import { getConfirmedBalance, getUnconfirmedBalance } from "@/lib/server/whatsonchain"

export const runtime = "nodejs"

export async function GET() {
  const token = await getExternalAuthToken()
  if (!token) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const address = await getExternalBsvAddress(token)
  if (!address) {
    return NextResponse.json(
      { success: false, message: "No BSV wallet address found. Log out and log in again to initialize it." },
      { status: 404 },
    )
  }

  const [confirmed, unconfirmed] = await Promise.all([
    getConfirmedBalance(address),
    getUnconfirmedBalance(address),
  ])

  return NextResponse.json({
    success: true,
    address,
    availableBalance: confirmed.confirmed,
    confirmedBalance: confirmed.confirmed,
    pendingBalance: unconfirmed.unconfirmed,
    unconfirmedBalance: unconfirmed.unconfirmed,
    reservedBalance: 0,
  })
}
