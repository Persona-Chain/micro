import crypto from "crypto"

export function randomToken(bytes: number = 32) {
  return crypto.randomBytes(bytes).toString("hex")
}

