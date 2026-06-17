import fs from "fs/promises"
import * as bsv from "bsv"

export function isBsvAddress(value: unknown) {
  if (typeof value !== "string") return false
  const address = value.trim()
  if (!/^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) return false

  try {
    bsv.Address.fromString(address)
    return true
  } catch {
    return false
  }
}

export function readSats(value: unknown) {
  const amount = Number(value)
  return Number.isInteger(amount) && amount > 0 ? amount : null
}

function uniqueValues(values: string[]) {
  return [...new Set(values.map((value) => value.replace(/\/+$/, "")).filter(Boolean))]
}

function getEggwalletBaseUrls() {
  const explicitEggwalletUrl =
    process.env.EGGWALLET_API_URL ||
    process.env.EGGWALLET_URL ||
    process.env.NEXT_PUBLIC_EGGWALLET_URL ||
    ""

  const authUrl = process.env.AUTH_API_URL || process.env.WALLET_API_URL || process.env.BOUNTYBEE_API_URL || ""
  const urls = uniqueValues([
    explicitEggwalletUrl,
    "http://127.0.0.1:8000",
    authUrl,
  ])

  if (!urls.length) throw new Error("Missing Eggwallet API URL.")
  return urls
}

function satsToBsvString(sats: number) {
  return (sats / 100_000_000).toFixed(8)
}

type EggwalletUserStore = Record<
  string,
  {
    addresses?: Record<
      string,
      {
        address?: string | null
        wif?: string | null
      }
    >
  }
>

function getEggwalletUsersFile() {
  return process.env.EGGWALLET_USERS_FILE || "C:\\Users\\DELL\\eggwallet\\eggwallet\\users.json"
}

async function getLocalEggwalletWifForAddress(address: string | null) {
  if (!address) return null

  let raw: string
  try {
    raw = await fs.readFile(getEggwalletUsersFile(), "utf8")
  } catch {
    return null
  }

  let users: EggwalletUserStore
  try {
    users = JSON.parse(raw) as EggwalletUserStore
  } catch {
    return null
  }

  const normalizedAddress = address.trim()
  for (const user of Object.values(users)) {
    const bsvWallet = user.addresses?.BSV
    if (bsvWallet?.address === normalizedAddress && bsvWallet.wif) {
      return bsvWallet.wif
    }
  }

  return null
}

export async function sendBsvWithEggwallet(input: {
  token: string
  fromAddress: string | null
  to: string
  amount: number
}) {
  const payload: Record<string, string> = {
    symbol: "BSV",
    address: input.to,
    amount: satsToBsvString(input.amount),
  }
  if (input.fromAddress) payload.from_address = input.fromAddress
  const cookieToken = encodeURIComponent(input.token)
  const errors: string[] = []
  let fallbackWif: string | null | undefined

  for (const includeFallbackWif of [false, true]) {
    if (includeFallbackWif) {
      fallbackWif = fallbackWif === undefined ? await getLocalEggwalletWifForAddress(input.fromAddress) : fallbackWif
      if (!fallbackWif) break
      payload.private_key_wif = fallbackWif
    }

    const result = await trySendBsvWithEggwalletUrls({
      token: input.token,
      cookieToken,
      payload,
      errors,
      useFallbackWif: includeFallbackWif,
    })
    if (result) return result

    if (!errors.some((error) => error.includes("wallet not connected (missing WIF)"))) break
  }

  delete payload.private_key_wif

  throw Object.assign(new Error(`Eggwallet BSV send failed. Tried ${errors.join("; ")}`), {
    status: 502,
  })
}

async function trySendBsvWithEggwalletUrls(input: {
  token: string
  cookieToken: string
  payload: Record<string, string>
  errors: string[]
  useFallbackWif: boolean
}) {
  for (const baseUrl of getEggwalletBaseUrls()) {
    const url = `${baseUrl}/api/send`
    let res: Response
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.token}`,
          Cookie: `eggwallet_auth_token=${input.cookieToken}; external_auth_token=${input.cookieToken}`,
        },
        body: JSON.stringify(input.payload),
        cache: "no-store",
      })
    } catch (error) {
      input.errors.push(`${url}: ${error instanceof Error ? error.message : "request failed"}`)
      continue
    }

    const data = (await res.json().catch(() => null)) as {
      success?: boolean
      txid?: string
      detail?: string
      error?: string
      message?: string
    } | null

    if (res.ok && data?.success !== false && data?.txid) {
      return { txid: data.txid, response: data, url, usedFallbackWif: input.useFallbackWif }
    }

    const message = data?.detail || data?.error || data?.message || res.statusText || "send failed"
    input.errors.push(`${url}: ${res.status} ${message}`)
    if (message === "wallet not connected (missing WIF)" && !input.useFallbackWif) {
      return null
    }

    if (![404, 405, 502, 503, 504].includes(res.status)) {
      throw Object.assign(new Error(message), {
        status: res.status || 400,
      })
    }
  }

  return null
}
