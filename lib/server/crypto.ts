import crypto from "crypto"

function getMasterKeyBytes() {
  const key = process.env.WALLET_MASTER_KEY
  if (!key) throw new Error("Missing WALLET_MASTER_KEY in environment")

  // Accept hex-encoded 32 bytes, otherwise derive a 32-byte key from the string.
  const hex = key.trim()
  if (/^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, "hex")

  return crypto.createHash("sha256").update(key, "utf8").digest()
}

export function encryptString(plaintext: string) {
  const key = getMasterKeyBytes()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext]).toString("base64")
}

export function decryptString(payloadB64: string) {
  const key = getMasterKeyBytes()
  const buf = Buffer.from(payloadB64, "base64")
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const ciphertext = buf.subarray(28)
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString("utf8")
}

