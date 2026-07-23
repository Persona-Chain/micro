import crypto from "crypto"
import { bountyBeeApiFetch, getExternalCurrentUser } from "@/lib/server/bountybee-api"
import { generateWalletFromWif, generateWalletMainnet } from "@/lib/server/bsv"
import { HttpError } from "@/lib/server/http"

type ExternalAuthResponse = {
  success?: boolean
  user_id?: number
  email?: string
  address?: string
  token?: string
  token_ttl_seconds?: number
  encrypted_key?: string
  message?: string
  error?: string
}

type ExternalWalletResponse = {
  success?: boolean
  symbol?: string
  wallet?: {
    address?: string | null
    encrypted_key?: string | null
    source?: string | null
  }
  message?: string
}

type ExternalWalletsResponse = {
  success?: boolean
  wallets?: Record<string, NonNullable<ExternalWalletResponse["wallet"]> | undefined>
  message?: string
}

function getExternalAuthConfig() {
  const baseUrl = (process.env.AUTH_API_URL || process.env.WALLET_API_URL || "").replace(/\/+$/, "")
  const serviceKey = process.env.AUTH_SERVICE_KEY || ""
  if (!baseUrl) throw new Error("Missing AUTH_API_URL in environment")
  if (!serviceKey) throw new Error("Missing AUTH_SERVICE_KEY in environment")
  return { baseUrl, serviceKey }
}

async function externalAuthFetch(path: string, body: Record<string, unknown>) {
  const { baseUrl, serviceKey } = getExternalAuthConfig()
  let res: Response
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Key": serviceKey,
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new HttpError("Authentication service is temporarily unavailable", 502)
  }
  const data = (await res.json().catch(() => null)) as ExternalAuthResponse | null
  if (!res.ok || data?.success === false) {
    const message = data?.message || data?.error
    if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 409) {
      throw new HttpError(message || "Authentication request rejected", res.status)
    }
    throw new HttpError(message || "Authentication service request failed", 502)
  }
  return data ?? {}
}

async function getExternalWallets(token: string) {
  const data = await bountyBeeApiFetch<ExternalWalletsResponse>("/api/v1/wallets", { token })
  return data.wallets || {}
}

async function saveExternalBsvWallet(input: {
  token: string
  address: string
  encryptedKey: string
}) {
  await bountyBeeApiFetch<ExternalWalletResponse>("/api/v1/wallets/BSV", {
    method: "PUT",
    token: input.token,
    body: {
      address: input.address,
      encrypted_key: input.encryptedKey,
      source: "eggwallet",
    },
  })
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

  return uniqueValues([explicitEggwalletUrl, "http://127.0.0.1:8000"])
}

async function importBsvWalletIntoEggwallet(input: {
  token: string
  wif: string
  email: string
}) {
  const cookieToken = encodeURIComponent(input.token)
  for (const baseUrl of getEggwalletBaseUrls()) {
    try {
      const res = await fetch(`${baseUrl}/api/wallet/import`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.token}`,
          Cookie: `eggwallet_auth_token=${cookieToken}; external_auth_token=${cookieToken}`,
        },
        body: JSON.stringify({
          symbol: "BSV",
          wif: input.wif,
          email: input.email,
        }),
        cache: "no-store",
      })

      if (res.ok) return
      const data = (await res.json().catch(() => null)) as { error?: string; detail?: string } | null
      console.warn("Eggwallet BSV import failed:", baseUrl, data?.detail || data?.error || res.statusText)
    } catch (error) {
      console.warn("Eggwallet BSV import request failed:", baseUrl, error instanceof Error ? error.message : error)
    }
  }
}

function passwordKey(password: string, salt: Buffer) {
  return crypto.pbkdf2Sync(password, salt, 210_000, 32, "sha256")
}

export function encryptWalletKeyForExternal(wif: string, password: string) {
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const key = passwordKey(password, salt)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([cipher.update(wif, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    "pbe",
    "v1",
    salt.toString("base64"),
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":")
}

export function decryptWalletKeyFromExternal(encryptedKey: string, password: string) {
  const [scheme, version, saltB64, ivB64, tagB64, ciphertextB64] = encryptedKey.split(":")
  if (scheme !== "pbe" || version !== "v1" || !saltB64 || !ivB64 || !tagB64 || !ciphertextB64) {
    throw new Error("Unsupported encrypted wallet key format")
  }

  const key = passwordKey(password, Buffer.from(saltB64, "base64"))
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64"))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]).toString("utf8")
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function usernameFromEmail(email: string) {
  const base = normalizeEmail(email)
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/[-.]{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 24)
  return base.length >= 3 ? base : `user${Date.now()}`
}

export async function createExternalAuthAccount(input: {
  email: string
  password: string
  username: string
}) {
  const wallet = generateWalletMainnet()
  const encryptedKey = encryptWalletKeyForExternal(wallet.wif, input.password)
  const email = normalizeEmail(input.email)

  const external = await externalAuthFetch("/api/v1/auth/signup", {
    email,
    password: input.password,
  })

  if (external.token) {
    await saveExternalBsvWallet({
      token: external.token,
      address: wallet.address,
      encryptedKey,
    })
    await importBsvWalletIntoEggwallet({
      token: external.token,
      wif: wallet.wif,
      email,
    })

    await bountyBeeApiFetch("/api/v1/users/sync", {
      token: external.token,
      body: {
        username: input.username,
        displayName: input.username,
        address: wallet.address,
        publicKey: wallet.publicKeyHex,
      },
    })
  }

  return { external }
}

export async function loginWithExternalAuth(input: {
  email: string
  password: string
  token?: string
}) {
  const email = normalizeEmail(input.email)
  const login = await externalAuthFetch("/api/v1/auth/login", {
    email,
    password: input.password,
    token: input.token || undefined,
  })

  if (!login.token) throw new Error("External auth did not return a session token")

  const wallets = await getExternalWallets(login.token)
  const bsvWallet = wallets.BSV || null
  let resolvedBsvWallet: NonNullable<ExternalWalletResponse["wallet"]>
  const existingEncryptedKey = bsvWallet?.encrypted_key || null
  const existingDerivedWallet = existingEncryptedKey
    ? generateWalletFromWif(decryptWalletKeyFromExternal(existingEncryptedKey, input.password))
    : null

  if (bsvWallet?.address) {
    resolvedBsvWallet = bsvWallet
  } else if (existingDerivedWallet && existingEncryptedKey) {
      await saveExternalBsvWallet({
        token: login.token,
        address: existingDerivedWallet.address,
        encryptedKey: existingEncryptedKey,
      })
      resolvedBsvWallet = {
        address: existingDerivedWallet.address,
        encrypted_key: existingEncryptedKey,
        source: "eggwallet",
      }
  } else {
    const wallet = generateWalletMainnet()
    const encryptedKey = encryptWalletKeyForExternal(wallet.wif, input.password)
    await saveExternalBsvWallet({
      token: login.token,
      address: wallet.address,
      encryptedKey,
    })
    resolvedBsvWallet = {
      address: wallet.address,
      encrypted_key: encryptedKey,
      source: "eggwallet",
    }
  }

  const encryptedKey = resolvedBsvWallet.encrypted_key || null
  const derivedWallet = encryptedKey
    ? generateWalletFromWif(decryptWalletKeyFromExternal(encryptedKey, input.password))
    : null
  const address = resolvedBsvWallet.address
  if (!address) throw new Error("External wallet storage did not return a BSV wallet address")
  const derivedWalletMatchesAddress = derivedWallet?.address === address
  if (derivedWallet?.wif && derivedWalletMatchesAddress) {
    await importBsvWalletIntoEggwallet({
      token: login.token,
      wif: derivedWallet.wif,
      email,
    })
  } else if (derivedWallet?.address && !derivedWalletMatchesAddress) {
    console.warn("Stored BSV encrypted key does not match stored BSV address; keeping address unchanged.")
  }

  let user = await getExternalCurrentUser(login.token)
  if (!user) {
    const syncBody: Record<string, string> = {
      username: usernameFromEmail(email),
      displayName: usernameFromEmail(email),
      address,
    }
    if (derivedWalletMatchesAddress && derivedWallet?.publicKeyHex) syncBody.publicKey = derivedWallet.publicKeyHex

    const synced = await bountyBeeApiFetch<{ user?: { id: number; username: string; email: string } }>("/api/v1/users/sync", {
      token: login.token,
      body: syncBody,
    })
    user = synced.user || await getExternalCurrentUser(login.token)
  } else {
    const syncBody: Record<string, string> = { address }
    if (derivedWalletMatchesAddress && derivedWallet?.publicKeyHex) syncBody.publicKey = derivedWallet.publicKeyHex

    await bountyBeeApiFetch("/api/v1/users/sync", {
      token: login.token,
      body: syncBody,
    })
  }

  if (!user) throw new Error("External backend did not return a user profile")

  return { external: login, user }
}
