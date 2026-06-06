import * as bsv from "bsv"
import { prisma } from "@/lib/server/prisma"
import { decryptString, encryptString } from "@/lib/server/crypto"
import { generateWalletMainnet } from "@/lib/server/bsv"
import { createNotification } from "@/lib/server/dashboard"
import {
  broadcastRawTx,
  getChainTipHeight,
  getConfirmedBalance,
  getConfirmedUtxos,
  getUnconfirmedBalance,
  getUnconfirmedUtxos,
} from "@/lib/server/whatsonchain"

const MIN_CONFIRMATIONS = 6
const PAYMAIL_DOMAIN = "bountybee.io"

function normalizePaymail(value: string) {
  return value.trim().toLowerCase()
}

function parseLocalPaymail(value: string) {
  const paymail = normalizePaymail(value)
  const [username, domain, ...extra] = paymail.split("@")
  if (!username || !domain || extra.length > 0) return null
  if (domain !== PAYMAIL_DOMAIN) return null
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) return null
  return { username, paymail }
}

export async function resolveLocalPaymail(paymailValue: string) {
  const parsed = parseLocalPaymail(paymailValue)
  if (!parsed) return null

  const userInclude = {
    wallet: true,
    profile: true,
    avatar: true,
  } as const

  let user = await prisma.user.findUnique({
    where: { username: parsed.username },
    include: userInclude,
  })

  if (!user) {
    const candidates = await prisma.user.findMany({
      include: userInclude,
      take: 250,
    })
    user =
      candidates.find(
        (candidate) =>
          candidate.username.toLowerCase() === parsed.username ||
          candidate.profile?.username?.toLowerCase() === parsed.username,
      ) ?? null
  }

  if (!user) return null

  const wallet = user.wallet ?? await getOrCreateWallet(user.id)

  return {
    userId: user.id,
    username: user.username,
    paymail: `${user.username}@${PAYMAIL_DOMAIN}`,
    displayName: user.profile?.displayName || user.username,
    avatarUrl: user.profile?.avatarUrl || user.avatar?.filePath || null,
    address: wallet.address,
  }
}

export async function getOrCreateWallet(userId: number) {
  const existing = await prisma.wallet.findUnique({ where: { userId } })
  if (existing) return existing

  const generated = generateWalletMainnet()
  const encryptedPrivateKey = encryptString(generated.wif)

  const wallet = await prisma.wallet.create({
    data: {
      userId,
      address: generated.address,
      encryptedPrivateKey,
      publicKey: generated.publicKeyHex,
    },
  })

  await prisma.internalBalance.upsert({
    where: { userId },
    update: {},
    create: { userId, availableBalance: 0, pendingBalance: 0 },
  })

  return wallet
}

export async function getWalletSummary(userId: number) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } })
  const balance = await prisma.internalBalance.findUnique({ where: { userId } })

  return {
    wallet,
    availableBalance: balance?.availableBalance ?? 0,
    pendingBalance: balance?.pendingBalance ?? 0,
  }
}

function mapWocUtxoToDb(walletId: number, address: string, tipHeight: number, u: any) {
  const confirmations = typeof u.height === "number" && u.height > 0 ? tipHeight - u.height + 1 : 0
  return {
    walletId,
    txid: u.tx_hash,
    vout: u.tx_pos,
    amount: u.value,
    address,
    confirmations,
  }
}

export async function syncWallet(userId: number) {
  const wallet = await getOrCreateWallet(userId)
  const [tipHeight, confirmed, unconfirmed, confirmedBal, unconfirmedBal] = await Promise.all([
    getChainTipHeight(),
    getConfirmedUtxos(wallet.address),
    getUnconfirmedUtxos(wallet.address),
    getConfirmedBalance(wallet.address),
    getUnconfirmedBalance(wallet.address),
  ])

  const confirmedUtxos = Array.isArray(confirmed) ? confirmed : []
  const unconfirmedUtxos = Array.isArray(unconfirmed) ? unconfirmed : []

  const all = [
    ...confirmedUtxos.map((u) => mapWocUtxoToDb(wallet.id, wallet.address, tipHeight, u)),
    ...unconfirmedUtxos.map((u) => mapWocUtxoToDb(wallet.id, wallet.address, tipHeight, u)),
  ]

  await prisma.utxo.deleteMany({ where: { walletId: wallet.id } })
  if (all.length > 0) {
    await prisma.utxo.createMany({
      data: all.map((u) => ({
        walletId: u.walletId,
        txid: u.txid,
        vout: u.vout,
        amount: u.amount,
        address: u.address,
        spent: false,
        confirmations: u.confirmations,
      })),
    })
  }

  // Prefer WoC balance endpoints for "exact" balance display.
  // confirmedBal is total confirmed; pending (unconfirmed) is mempool. citeturn0search0
  const chainAvailable = Math.max(0, Number(confirmedBal?.confirmed ?? 0))
  const pending = Math.max(0, Number(unconfirmedBal?.unconfirmed ?? 0))
  const currentBalance = await prisma.internalBalance.findUnique({
    where: { userId },
    select: { availableBalance: true, reservedBalance: true },
  })
  const reserved = currentBalance?.reservedBalance ?? 0
  const chainSpendable = Math.max(0, chainAvailable - reserved)
  const available = Math.max(currentBalance?.availableBalance ?? 0, chainSpendable)

  await prisma.internalBalance.upsert({
    where: { userId },
    update: { availableBalance: available, pendingBalance: pending },
    create: { userId, availableBalance: available, pendingBalance: pending },
  })

  // Best-effort deposit history: record txids we see as deposits if not present.
  const seenTxids = Array.from(new Set(all.map((u) => u.txid)))
  for (const txid of seenTxids) {
    const amount = all.filter((u) => u.txid === txid).reduce((sum, u) => sum + u.amount, 0)
    const confirmations = all.find((u) => u.txid === txid)?.confirmations ?? 0
    const status = confirmations >= MIN_CONFIRMATIONS || confirmations > 0 ? "confirmed" : "pending"
    const exists = await prisma.transaction.findUnique({ where: { txid }, select: { id: true } })
    if (exists) {
      await prisma.transaction.update({
        where: { txid },
        data: { amount, confirmations, status },
      })
      continue
    }
    await prisma.transaction.create({
      data: {
        userId,
        txid,
        type: "deposit",
        amount,
        fee: 0,
        confirmations,
        status,
        address: wallet.address,
      },
    })
    await createNotification(
      userId,
      "payment",
      `Deposit received: ${amount} sats to ${wallet.address}`,
      "/wallet",
    )
  }

  return { address: wallet.address, availableBalance: available, pendingBalance: pending }
}

function selectUtxos(utxos: Array<{ txid: string; vout: number; amount: number }>, target: number) {
  const sorted = [...utxos].sort((a, b) => b.amount - a.amount)
  const selected: typeof sorted = []
  let total = 0
  for (const u of sorted) {
    selected.push(u)
    total += u.amount
    if (total >= target) break
  }
  return { selected, total }
}

export async function withdraw(userId: number, toAddress: string, amount: number) {
  if (!toAddress || !amount || amount <= 0) {
    throw new Error("Invalid withdrawal request")
  }

  let paymailRecipient: Awaited<ReturnType<typeof resolveLocalPaymail>> = null
  if (toAddress.includes("@")) {
    paymailRecipient = await resolveLocalPaymail(toAddress)
    if (!paymailRecipient) {
      throw new Error("Paymail not found. Use a valid BountyBee paymail like username@bountybee.io.")
    }
    if (paymailRecipient.userId === userId) {
      throw new Error("You cannot transfer funds to your own paymail.")
    }
    toAddress = paymailRecipient.address
  }

  if (toAddress.toLowerCase().startsWith("lnbc")) {
    throw new Error("Lightning invoices are not supported. Use a BSV address or BountyBee paymail.")
  }

  const wallet = await getOrCreateWallet(userId)
  const privateKeyWif = decryptString(wallet.encryptedPrivateKey)
  const privateKey = bsv.PrivKey.fromWif(privateKeyWif)
  const keyPair = bsv.KeyPair.fromPrivKey(privateKey)

  const availableUtxos = await prisma.utxo.findMany({
    where: { walletId: wallet.id, spent: false, confirmations: { gt: 0 } },
    orderBy: { amount: "desc" },
  })

  const totalAvailable = availableUtxos.reduce((sum, utxo) => sum + utxo.amount, 0)
  const fee = 1000
  const required = amount + fee

  if (totalAvailable < required) {
    throw new Error("Insufficient funds for withdrawal plus network fee")
  }

  const txb = new bsv.TxBuilder()
  txb.setChangeAddress(bsv.Address.fromString(wallet.address))
  txb.setFeePerKbNum(500)
  txb.sendDustChangeToFees(true)

  const fromScript = bsv.Address.fromString(wallet.address).toTxOutScript()
  const publicKey = keyPair.toPublic().pubKey

  for (const utxo of availableUtxos) {
    if (!/^[0-9a-fA-F]{64}$/.test(utxo.txid)) {
      throw new Error(`Invalid UTXO txid: ${utxo.txid}`)
    }

    const prevTxHash = Buffer.from(utxo.txid, "hex").reverse()
    const txOut = bsv.TxOut.fromProperties(new bsv.Bn(utxo.amount), fromScript)
    txb.inputFromPubKeyHash(prevTxHash, utxo.vout, txOut, publicKey)
  }

  txb.outputToAddress(new bsv.Bn(amount), bsv.Address.fromString(toAddress))
  txb.build()

  for (let i = 0; i < txb.tx.txIns.length; i++) {
    txb.signTxIn(i, keyPair)
  }

  const usedUtxos: Array<{ txid: string; vout: number; amount: number }> = txb.tx.txIns.map((txIn: any) => ({
    txid: Buffer.from(txIn.txHashBuf).reverse().toString("hex"),
    vout: txIn.txOutNum,
    amount: availableUtxos.find(
      (utxo) => utxo.txid.toLowerCase() === Buffer.from(txIn.txHashBuf).reverse().toString("hex").toLowerCase() && utxo.vout === txIn.txOutNum,
    )?.amount ?? 0,
  }))
  const actualFee = Number(txb.feeAmountBn?.toNumber?.() ?? fee)

  if (usedUtxos.reduce((sum: number, utxo: { amount: number }) => sum + utxo.amount, 0) < amount + actualFee) {
    throw new Error("Unable to select enough UTXOs for withdrawal")
  }

  const result = await finalizeBroadcast(userId, wallet.id, wallet.address, toAddress, usedUtxos, amount, actualFee, txb.tx)
  return paymailRecipient ? { ...result, type: "paymail_transfer", recipient: paymailRecipient } : result
}

export async function sendOnChainPayment(userId: number, toAddress: string, amount: number) {
  if (!toAddress || !amount || amount <= 0) {
    throw new Error("Invalid payment request")
  }

  await syncWallet(userId)

  const wallet = await getOrCreateWallet(userId)
  const privateKeyWif = decryptString(wallet.encryptedPrivateKey)
  const privateKey = bsv.PrivKey.fromWif(privateKeyWif)
  const keyPair = bsv.KeyPair.fromPrivKey(privateKey)

  const availableUtxos = await prisma.utxo.findMany({
    where: { walletId: wallet.id, spent: false, confirmations: { gt: 0 } },
    orderBy: { amount: "desc" },
  })

  const fee = 1000
  const totalAvailable = availableUtxos.reduce((sum, utxo) => sum + utxo.amount, 0)
  if (totalAvailable < amount + fee) {
    throw new Error("Insufficient confirmed on-chain funds for platform fee")
  }

  const txb = new bsv.TxBuilder()
  txb.setChangeAddress(bsv.Address.fromString(wallet.address))
  txb.setFeePerKbNum(500)
  txb.sendDustChangeToFees(true)

  const fromScript = bsv.Address.fromString(wallet.address).toTxOutScript()
  const publicKey = keyPair.toPublic().pubKey

  for (const utxo of availableUtxos) {
    if (!/^[0-9a-fA-F]{64}$/.test(utxo.txid)) {
      throw new Error(`Invalid UTXO txid: ${utxo.txid}`)
    }

    const prevTxHash = Buffer.from(utxo.txid, "hex").reverse()
    const txOut = bsv.TxOut.fromProperties(new bsv.Bn(utxo.amount), fromScript)
    txb.inputFromPubKeyHash(prevTxHash, utxo.vout, txOut, publicKey)
  }

  txb.outputToAddress(new bsv.Bn(amount), bsv.Address.fromString(toAddress))
  txb.build()

  for (let i = 0; i < txb.tx.txIns.length; i++) {
    txb.signTxIn(i, keyPair)
  }

  const usedUtxos: Array<{ txid: string; vout: number; amount: number }> = txb.tx.txIns.map((txIn: any) => ({
    txid: Buffer.from(txIn.txHashBuf).reverse().toString("hex"),
    vout: txIn.txOutNum,
    amount: availableUtxos.find(
      (utxo) => utxo.txid.toLowerCase() === Buffer.from(txIn.txHashBuf).reverse().toString("hex").toLowerCase() && utxo.vout === txIn.txOutNum,
    )?.amount ?? 0,
  }))
  const actualFee = Number(txb.feeAmountBn?.toNumber?.() ?? fee)

  if (usedUtxos.reduce((sum: number, utxo: { amount: number }) => sum + utxo.amount, 0) < amount + actualFee) {
    throw new Error("Unable to select enough UTXOs for platform fee")
  }

  const txid = await broadcastRawTx(txb.tx.toString())

  await prisma.utxo.updateMany({
    where: {
      walletId: wallet.id,
      OR: usedUtxos.map((u) => ({ txid: u.txid, vout: u.vout })),
    },
    data: { spent: true, confirmations: 0 },
  })

  await prisma.internalBalance.update({
    where: { userId },
    data: {
      availableBalance: { decrement: amount + actualFee },
    },
  })

  return { txid: String(txid).trim(), fee: actualFee, fromAddress: wallet.address }
}

export async function sendEscrowOnChainPayment(userId: number, toAddress: string, amount: number) {
  if (!toAddress || !amount || amount <= 0) {
    throw new Error("Invalid escrow payout request")
  }

  await syncWallet(userId)

  const wallet = await getOrCreateWallet(userId)
  const privateKeyWif = decryptString(wallet.encryptedPrivateKey)
  const privateKey = bsv.PrivKey.fromWif(privateKeyWif)
  const keyPair = bsv.KeyPair.fromPrivKey(privateKey)

  const availableUtxos = await prisma.utxo.findMany({
    where: { walletId: wallet.id, spent: false, confirmations: { gt: 0 } },
    orderBy: { amount: "desc" },
  })

  const fee = 1000
  const totalAvailable = availableUtxos.reduce((sum, utxo) => sum + utxo.amount, 0)
  if (totalAvailable < amount + fee) {
    throw new Error("Insufficient confirmed on-chain funds for worker payout")
  }

  const txb = new bsv.TxBuilder()
  txb.setChangeAddress(bsv.Address.fromString(wallet.address))
  txb.setFeePerKbNum(500)
  txb.sendDustChangeToFees(true)

  const fromScript = bsv.Address.fromString(wallet.address).toTxOutScript()
  const publicKey = keyPair.toPublic().pubKey

  for (const utxo of availableUtxos) {
    if (!/^[0-9a-fA-F]{64}$/.test(utxo.txid)) {
      throw new Error(`Invalid UTXO txid: ${utxo.txid}`)
    }

    const prevTxHash = Buffer.from(utxo.txid, "hex").reverse()
    const txOut = bsv.TxOut.fromProperties(new bsv.Bn(utxo.amount), fromScript)
    txb.inputFromPubKeyHash(prevTxHash, utxo.vout, txOut, publicKey)
  }

  txb.outputToAddress(new bsv.Bn(amount), bsv.Address.fromString(toAddress))
  txb.build()

  for (let i = 0; i < txb.tx.txIns.length; i++) {
    txb.signTxIn(i, keyPair)
  }

  const usedUtxos: Array<{ txid: string; vout: number; amount: number }> = txb.tx.txIns.map((txIn: any) => ({
    txid: Buffer.from(txIn.txHashBuf).reverse().toString("hex"),
    vout: txIn.txOutNum,
    amount: availableUtxos.find(
      (utxo) => utxo.txid.toLowerCase() === Buffer.from(txIn.txHashBuf).reverse().toString("hex").toLowerCase() && utxo.vout === txIn.txOutNum,
    )?.amount ?? 0,
  }))
  const actualFee = Number(txb.feeAmountBn?.toNumber?.() ?? fee)

  if (usedUtxos.reduce((sum: number, utxo: { amount: number }) => sum + utxo.amount, 0) < amount + actualFee) {
    throw new Error("Unable to select enough UTXOs for worker payout")
  }

  const txid = await broadcastRawTx(txb.tx.toString())

  await prisma.utxo.updateMany({
    where: {
      walletId: wallet.id,
      OR: usedUtxos.map((u) => ({ txid: u.txid, vout: u.vout })),
    },
    data: { spent: true, confirmations: 0 },
  })

  return { txid: String(txid).trim(), fee: actualFee, fromAddress: wallet.address }
}

async function finalizeBroadcast(
  userId: number,
  walletId: number,
  fromAddress: string,
  toAddress: string,
  usedUtxos: Array<{ txid: string; vout: number; amount: number }>,
  amount: number,
  fee: number,
  tx: any,
) {
  const txhex = tx.toString()
  const txid = await broadcastRawTx(txhex)

  await prisma.transaction.create({
    data: {
      userId,
      txid: String(txid).trim(),
      type: "withdrawal",
      amount,
      fee,
      confirmations: 0,
      status: "broadcast",
      address: toAddress,
    },
  })
  await createNotification(
    userId,
    "payment",
    `Withdrawal broadcast: ${amount} sats from ${fromAddress} to ${toAddress}`,
    "/wallet",
  )

  await prisma.utxo.updateMany({
    where: {
      walletId,
      OR: usedUtxos.map((u) => ({ txid: u.txid, vout: u.vout })),
    },
    data: { spent: true, confirmations: 0 },
  })

  const delta = amount + fee
  await prisma.internalBalance.update({
    where: { userId },
    data: {
      availableBalance: { decrement: delta },
    },
  })

  return { txid: String(txid).trim(), fee }
}
