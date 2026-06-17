type WocUtxo = {
  tx_hash: string
  tx_pos: number
  value: number
  height: number
  isSpentInMempoolTx?: boolean
  status?: "confirmed" | "unconfirmed"
}

type ChainInfo = {
  blocks: number
}

type WocAddressHistoryItem = {
  tx_hash: string
  height?: number
}

type WocAddressHistory = {
  result?: WocAddressHistoryItem[]
  error?: string
}

type WocTransactionInput = {
  address?: string
  txid?: string
  vout?: number
  coinbase?: string
}

type WocTransactionOutput = {
  value?: number
  n?: number
  scriptPubKey?: {
    address?: string
    addresses?: string[]
  }
}

export type WocTransaction = {
  txid: string
  hash?: string
  vin?: WocTransactionInput[]
  vout?: WocTransactionOutput[]
  confirmations?: number
  time?: number
  blocktime?: number
  blockheight?: number
}

function getBaseUrl() {
  // BSV mainnet
  return "https://api.whatsonchain.com/v1/bsv/main"
}

function getAuthHeader() {
  const key = process.env.WHATSONCHAIN_API_KEY
  if (!key) return {} as Record<string, string>
  return { Authorization: key } as Record<string, string>
}

async function wocGetJson<T>(path: string): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, { headers: getAuthHeader() })
  if (res.status === 404) {
    // WhatsOnChain returns 404 for brand-new/unused addresses on some endpoints.
    // Callers can decide how to treat missing data.
    throw Object.assign(new Error("WOC_NOT_FOUND"), { code: "WOC_NOT_FOUND" as const })
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`WhatsOnChain GET ${path} failed: ${res.status} ${text}`)
  }
  return (await res.json()) as T
}

async function wocPostJson<T>(path: string, body: unknown, acceptText?: boolean): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeader() } as any,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`WhatsOnChain POST ${path} failed: ${res.status} ${text}`)
  }

  if (acceptText) {
    return (await res.text()) as unknown as T
  }
  return (await res.json()) as T
}

export async function getChainTipHeight() {
  const info = await wocGetJson<ChainInfo>("/chain/info")
  return info.blocks
}

export async function getConfirmedBalance(address: string) {
  // Returns `{ confirmed: number }` (satoshis). citeturn0search0
  try {
    return await wocGetJson<{ confirmed: number }>(`/address/${address}/confirmed/balance`)
  } catch (e: any) {
    if (e?.code === "WOC_NOT_FOUND" || e?.message === "WOC_NOT_FOUND") return { confirmed: 0 }
    throw e
  }
}

export async function getUnconfirmedBalance(address: string) {
  // Returns `{ unconfirmed: number }` (satoshis). citeturn0search0
  try {
    return await wocGetJson<{ unconfirmed: number }>(`/address/${address}/unconfirmed/balance`)
  } catch (e: any) {
    if (e?.code === "WOC_NOT_FOUND" || e?.message === "WOC_NOT_FOUND") return { unconfirmed: 0 }
    throw e
  }
}

export async function getConfirmedUtxos(address: string) {
  try {
    const data = await wocGetJson<any>(`/address/${address}/confirmed/unspent`)
    if (Array.isArray(data)) return data as WocUtxo[]
    // Defensive: some APIs return `{ unspent: [...] }` or `{ result: [...] }`.
    if (data && Array.isArray(data.unspent)) return data.unspent as WocUtxo[]
    if (data && Array.isArray(data.result)) return data.result as WocUtxo[]
    return []
  } catch (e: any) {
    if (e?.code === "WOC_NOT_FOUND" || e?.message === "WOC_NOT_FOUND") return []
    throw e
  }
}

export async function getUnconfirmedUtxos(address: string) {
  try {
    const data = await wocGetJson<any>(`/address/${address}/unconfirmed/unspent`)
    if (Array.isArray(data)) return data as WocUtxo[]
    if (data && Array.isArray(data.unspent)) return data.unspent as WocUtxo[]
    if (data && Array.isArray(data.result)) return data.result as WocUtxo[]
    return []
  } catch (e: any) {
    if (e?.code === "WOC_NOT_FOUND" || e?.message === "WOC_NOT_FOUND") return []
    throw e
  }
}

export async function getConfirmedAddressHistory(address: string, limit = 20) {
  try {
    const params = new URLSearchParams({ limit: String(limit), order: "desc" })
    const data = await wocGetJson<WocAddressHistory>(`/address/${address}/confirmed/history?${params}`)
    return Array.isArray(data.result) ? data.result : []
  } catch (e: any) {
    if (e?.code === "WOC_NOT_FOUND" || e?.message === "WOC_NOT_FOUND") return []
    throw e
  }
}

export async function getUnconfirmedAddressHistory(address: string) {
  try {
    const data = await wocGetJson<WocAddressHistory>(`/address/${address}/unconfirmed/history`)
    return Array.isArray(data.result) ? data.result : []
  } catch (e: any) {
    if (e?.code === "WOC_NOT_FOUND" || e?.message === "WOC_NOT_FOUND") return []
    throw e
  }
}

export async function getTransaction(txid: string) {
  return wocGetJson<WocTransaction>(`/tx/hash/${txid}`)
}

export async function broadcastRawTx(txhex: string) {
  // Returns txid as text/plain on success. citeturn3view0
  return wocPostJson<string>("/tx/raw", { txhex }, true)
}
