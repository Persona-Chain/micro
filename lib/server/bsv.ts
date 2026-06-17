import * as bsv from "bsv"

export function generateWalletMainnet() {
  const privKey = bsv.PrivKey.fromRandom()
  const address = bsv.Address.fromPrivKey(privKey).toString()
  const pubKey = bsv.PubKey.fromPrivKey(privKey)
  const wif = privKey.toWif()
  return { address, publicKeyHex: pubKey.toString(), wif }
}

export function generateWalletFromWif(wif: string) {
  const privKey = bsv.PrivKey.fromWif(wif)
  const address = bsv.Address.fromPrivKey(privKey).toString()
  const pubKey = bsv.PubKey.fromPrivKey(privKey)
  return { address, publicKeyHex: pubKey.toString(), wif }
}
