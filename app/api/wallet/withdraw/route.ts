import { proxyBountyBeeRequest } from "@/lib/server/bountybee-proxy"
import { BountyBeeApiError } from "@/lib/server/bountybee-api"
import { getExternalAuthToken, getExternalBsvWallet } from "@/lib/server/external-wallets"
import { isBsvAddress, readSats, sendBsvWithEggwallet } from "@/lib/server/eggwallet-send"
import { getConfirmedBalance } from "@/lib/server/whatsonchain"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

function makeJsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

async function syncWallet(req: Request, availableBalance: number | null) {
  const body: Record<string, unknown> = {}
  if (availableBalance !== null) {
    body.availableBalance = availableBalance
    body.confirmedBalance = availableBalance
  }

  return proxyBountyBeeRequest(makeJsonRequest(req.url, body), "/api/v1/wallet/sync", { auth: true })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const address = typeof body?.to === "string" ? body.to : body?.address
  const amount = readSats(body?.amount)

  if (!isBsvAddress(address)) {
    return NextResponse.json(
      {
        success: false,
        message: "Enter a valid on-chain BSV address. Paymail, CashAddr, BTC SegWit, and Hatch addresses are not accepted.",
      },
      { status: 400 },
    )
  }

  if (amount === null) {
    return NextResponse.json(
      {
        success: false,
        message: "Enter a valid withdrawal amount in satoshis.",
      },
      { status: 400 },
    )
  }

  const to = address.trim()
  const token = await getExternalAuthToken()
  if (!token) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  let walletAddress: string | null = null
  let availableBalance: number | null = null
  try {
    const wallet = await getExternalBsvWallet(token)
    walletAddress = wallet?.address || null
  } catch (error) {
    if (error instanceof BountyBeeApiError && error.status === 401) {
      return NextResponse.json(
        { success: false, message: "Your external wallet session expired. Log in again before sending BSV." },
        { status: 401 },
      )
    }

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unable to load your BSV wallet before sending.",
      },
      { status: 502 },
    )
  }

  if (walletAddress) {
    try {
      availableBalance = (await getConfirmedBalance(walletAddress)).confirmed
    } catch {
      availableBalance = null
    }
  }

  if (availableBalance !== null && amount > availableBalance) {
    return NextResponse.json(
      {
        success: false,
        message: "Insufficient confirmed on-chain balance for this withdrawal.",
        availableBalance,
      },
      { status: 402 },
    )
  }

  if (!walletAddress) {
    return NextResponse.json(
      {
        success: false,
        message: "No BSV wallet address was found for this account. Log out and log in again to initialize it.",
      },
      { status: 404 },
    )
  }

  const syncResponse = await syncWallet(req, availableBalance)
  if (syncResponse.status === 401) {
    return NextResponse.json(
      { success: false, message: "Your external wallet session expired. Log in again before sending BSV." },
      { status: 401 },
    )
  }

  let sent: Awaited<ReturnType<typeof sendBsvWithEggwallet>>
  try {
    sent = await sendBsvWithEggwallet({
      token,
      fromAddress: walletAddress,
      to,
      amount,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to send BSV withdrawal.",
      },
      { status: Number(error?.status) || 400 },
    )
  }

  const recordResponse = await proxyBountyBeeRequest(
    makeJsonRequest(req.url, {
      to,
      amount,
      txid: sent.txid,
      status: "pending",
    }),
    "/api/v1/wallet/withdraw/broadcast",
    { auth: true },
  )
  const recordData = await recordResponse.json().catch(() => null)

  return NextResponse.json({
    success: true,
    txid: sent.txid,
    recordStatus: recordResponse.status,
    record: recordData,
    send: sent.response,
    usedFallbackWif: sent.usedFallbackWif,
  })
}
