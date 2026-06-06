import crypto from "crypto"
import * as bsv from "bsv"
import { bountyBeeApiFetch, getExternalCurrentUser } from "@/lib/server/bountybee-api"
import { generateWalletMainnet } from "@/lib/server/bsv"

type ExternalAuthResponse = {
  success?: boolean
  user_id?: number
  email?: string
  address?: string
  token?: string
  token_ttl_seconds?: number
  encrypted_key?: string
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
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Key": serviceKey,
    },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => null)) as ExternalAuthResponse | null
  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || "External auth request failed")
  }
  return data ?? {}
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

function publicKeyFromWif(wif: string) {
  const privKey = bsv.PrivKey.fromWif(wif)
  return bsv.PubKey.fromPrivKey(privKey).toString()
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
    address: wallet.address,
    encrypted_key: encryptedKey,
  })

  if (external.token) {
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

  const walletKey = await externalAuthFetch("/api/v1/auth/wallet-key", {
    token: login.token,
  })
  if (!walletKey.encrypted_key) throw new Error("External auth did not return an encrypted wallet key")

  const address = walletKey.address || login.address
  if (!address) throw new Error("External auth did not return a wallet address")

  let user = await getExternalCurrentUser(login.token)
  if (!user) {
    const wif = decryptWalletKeyFromExternal(walletKey.encrypted_key, input.password)
    const synced = await bountyBeeApiFetch<{ user?: { id: number; username: string; email: string } }>("/api/v1/users/sync", {
      token: login.token,
      body: {
        username: usernameFromEmail(email),
        displayName: usernameFromEmail(email),
        address,
        publicKey: publicKeyFromWif(wif),
      },
    })
    user = synced.user || await getExternalCurrentUser(login.token)
  }

  if (!user) throw new Error("External backend did not return a user profile")

  return { external: login, user }
}
