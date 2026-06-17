import { cookies } from "next/headers"
import { EXTERNAL_AUTH_COOKIE_NAME } from "@/lib/server/auth"
import { bountyBeeApiFetch } from "@/lib/server/bountybee-api"

type WalletsResponse = {
  wallets?: {
    BSV?: {
      address?: string | null
      encrypted_key?: string | null
      encryptedKey?: string | null
      source?: string | null
    }
  }
}

type WalletResponse = {
  address?: string | null
  encrypted_key?: string | null
  encryptedKey?: string | null
  source?: string | null
  wallet?: {
    address?: string | null
    encrypted_key?: string | null
    encryptedKey?: string | null
    source?: string | null
  }
}

type WalletKeyResponse = {
  success?: boolean
  address?: string | null
  encrypted_key?: string | null
  encryptedKey?: string | null
  wallet?: {
    address?: string | null
    encrypted_key?: string | null
    encryptedKey?: string | null
  }
  message?: string | null
}

function getExternalAuthWalletKeyConfig() {
  const baseUrl = (process.env.AUTH_API_URL || process.env.WALLET_API_URL || "").replace(/\/+$/, "")
  const serviceKey = process.env.AUTH_SERVICE_KEY || ""
  if (!baseUrl) throw new Error("Missing AUTH_API_URL or WALLET_API_URL in environment")
  if (!serviceKey) throw new Error("Missing AUTH_SERVICE_KEY in environment")
  return { baseUrl, serviceKey }
}

export async function getExternalAuthToken() {
  return (await cookies()).get(EXTERNAL_AUTH_COOKIE_NAME)?.value || null
}

function normalizeWallet(wallet: WalletResponse["wallet"] | WalletResponse | null | undefined) {
  if (!wallet) return null
  return {
    address: wallet.address || null,
    encrypted_key: wallet.encrypted_key || wallet.encryptedKey || null,
    source: wallet.source || null,
  }
}

function normalizeWalletKey(data: WalletKeyResponse | null | undefined) {
  if (!data) return {}
  return {
    address: data.address || data.wallet?.address || null,
    encrypted_key: data.encrypted_key || data.encryptedKey || data.wallet?.encrypted_key || data.wallet?.encryptedKey || null,
  }
}

export async function getExternalBsvAddress(token: string) {
  const data = await bountyBeeApiFetch<WalletsResponse>("/api/v1/wallets", { token })
  return data.wallets?.BSV?.address || null
}

export async function getExternalBsvWallet(token: string) {
  const data = await bountyBeeApiFetch<WalletsResponse>("/api/v1/wallets", { token })
  const listedWallet = normalizeWallet(data.wallets?.BSV)
  if (listedWallet?.encrypted_key) return listedWallet

  const single = await bountyBeeApiFetch<WalletResponse>("/api/v1/wallets/BSV", { token }).catch(() => null)
  return normalizeWallet(single?.wallet || single) || listedWallet
}

export async function getExternalAuthWalletKey(token: string) {
  const { baseUrl, serviceKey } = getExternalAuthWalletKeyConfig()
  const res = await fetch(`${baseUrl}/api/v1/auth/wallet-key`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Service-Key": serviceKey,
    },
    body: JSON.stringify({ token }),
    cache: "no-store",
  })
  const data = (await res.json().catch(() => null)) as WalletKeyResponse | null
  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || "External auth wallet-key request failed")
  }
  return normalizeWalletKey(data)
}
