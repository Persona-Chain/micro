import { NextResponse } from "next/server"
import { getExternalAuthToken, getExternalBsvAddress } from "@/lib/server/external-wallets"
import {
  getConfirmedAddressHistory,
  getTransaction,
  getUnconfirmedAddressHistory,
  type WocTransaction,
} from "@/lib/server/whatsonchain"

export const runtime = "nodejs"

type WalletHistoryTransaction = {
  txid: string
  type: "deposit" | "withdrawal"
  amount: number
  fee: number | null
  confirmations: number
  status: "completed" | "pending"
  address: string
  createdAt: string
}

function bsvToSats(value: unknown) {
  const bsv = Number(value || 0)
  return Number.isFinite(bsv) ? Math.round(bsv * 100_000_000) : 0
}

function outputAddresses(output: NonNullable<WocTransaction["vout"]>[number]) {
  const script = output.scriptPubKey
  return [script?.address, ...(script?.addresses || [])].filter((value): value is string => Boolean(value))
}

function hasOutputAddress(output: NonNullable<WocTransaction["vout"]>[number], address: string) {
  return outputAddresses(output).includes(address)
}

function firstAddress(values: Array<string | undefined>) {
  return values.find((value) => value && value.trim()) || ""
}

async function inputValueFromWallet(
  input: NonNullable<WocTransaction["vin"]>[number],
  address: string,
  txCache: Map<string, Promise<WocTransaction>>,
) {
  if (input.address === address) return 0
  if (!input.txid || input.vout === undefined || input.coinbase) return 0

  const previousTxPromise = txCache.get(input.txid) || getTransaction(input.txid)
  txCache.set(input.txid, previousTxPromise)
  const previousTx = await previousTxPromise
  const previousOutput = (previousTx.vout || []).find((output) => output.n === input.vout)
  if (!previousOutput || !hasOutputAddress(previousOutput, address)) return 0
  return bsvToSats(previousOutput.value)
}

async function normalizeWocTransaction(
  tx: WocTransaction,
  address: string,
  txCache: Map<string, Promise<WocTransaction>>,
): Promise<WalletHistoryTransaction | null> {
  const outputs = tx.vout || []
  const inputs = tx.vin || []
  const outputsToWallet = outputs.filter((output) => hasOutputAddress(output, address))
  const outputsFromWallet = outputs.filter((output) => !hasOutputAddress(output, address))
  const inputAddresses = inputs.map((input) => input.address).filter((value): value is string => Boolean(value))
  const directSpendByWallet = inputAddresses.includes(address)
  const previousInputValues = directSpendByWallet
    ? []
    : await mapWithConcurrency(inputs, 3, (input) => inputValueFromWallet(input, address, txCache))
  const spentByWallet = directSpendByWallet || previousInputValues.some((value) => value > 0)
  const receivedSats = outputsToWallet.reduce((sum, output) => sum + bsvToSats(output.value), 0)

  if (spentByWallet) {
    const sentOutputs = outputsFromWallet.filter((output) => outputAddresses(output).length > 0)
    const sentSats = sentOutputs.reduce((sum, output) => sum + bsvToSats(output.value), 0)
    return {
      txid: tx.txid || tx.hash || "",
      type: "withdrawal",
      amount: sentSats || Math.max(0, outputs.reduce((sum, output) => sum + bsvToSats(output.value), 0) - receivedSats),
      fee: null,
      confirmations: tx.confirmations || 0,
      status: tx.confirmations ? "completed" : "pending",
      address: firstAddress(sentOutputs.flatMap(outputAddresses)),
      createdAt: new Date(((tx.blocktime || tx.time || Math.floor(Date.now() / 1000)) as number) * 1000).toISOString(),
    }
  }

  if (receivedSats > 0) {
    return {
      txid: tx.txid || tx.hash || "",
      type: "deposit",
      amount: receivedSats,
      fee: null,
      confirmations: tx.confirmations || 0,
      status: tx.confirmations ? "completed" : "pending",
      address: firstAddress(inputAddresses),
      createdAt: new Date(((tx.blocktime || tx.time || Math.floor(Date.now() / 1000)) as number) * 1000).toISOString(),
    }
  }

  return null
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>) {
  const results: R[] = []
  let index = 0

  async function worker() {
    while (index < items.length) {
      const currentIndex = index
      index += 1
      results[currentIndex] = await mapper(items[currentIndex])
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

export async function GET(req: Request) {
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

  const limitParam = Number(new URL(req.url).searchParams.get("limit") || 20)
  const limit = Number.isInteger(limitParam) ? Math.min(Math.max(limitParam, 1), 20) : 20

  try {
    const [confirmed, unconfirmed] = await Promise.all([
      getConfirmedAddressHistory(address, limit),
      getUnconfirmedAddressHistory(address),
    ])
    const history = [...unconfirmed, ...confirmed]
    const txids = Array.from(new Set(history.map((item) => item.tx_hash).filter(Boolean))).slice(0, limit)
    const txCache = new Map<string, Promise<WocTransaction>>()
    const details = await mapWithConcurrency(txids, 3, (txid) => {
      const promise = getTransaction(txid)
      txCache.set(txid, promise)
      return promise
    })
    const normalized = await mapWithConcurrency(details, 3, (tx) => normalizeWocTransaction(tx, address, txCache))
    const transactions = normalized
      .filter((tx): tx is WalletHistoryTransaction => Boolean(tx && tx.txid))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ success: true, address, transactions })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unable to load WhatsOnChain transaction history.",
      },
      { status: 502 },
    )
  }
}
