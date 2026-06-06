import type { Prisma } from "@prisma/client"
import { encryptString } from "@/lib/server/crypto"
import { generateWalletMainnet } from "@/lib/server/bsv"
import { PLATFORM_REVENUE_ADDRESS } from "@/lib/server/admin-analytics"

async function getOrCreatePlatformAdmin(tx: Prisma.TransactionClient) {
  const admin = await tx.user.findUnique({
    where: { username: "admin" },
    select: { id: true, wallet: { select: { address: true } } },
  })
  if (!admin) throw new Error("Platform admin account not found")
  if (admin.wallet?.address) return { id: admin.id, address: admin.wallet.address }

  const generated = generateWalletMainnet()
  const wallet = await tx.wallet.create({
    data: {
      userId: admin.id,
      address: generated.address,
      encryptedPrivateKey: encryptString(generated.wif),
      publicKey: generated.publicKeyHex,
    },
    select: { address: true },
  })

  return { id: admin.id, address: wallet.address }
}

export async function getPlatformRevenueAddress(tx: Prisma.TransactionClient) {
  await getOrCreatePlatformAdmin(tx)
  return PLATFORM_REVENUE_ADDRESS
}

export async function creditPlatformFee(
  tx: Prisma.TransactionClient,
  input: {
    amount: number
    txid: string
    taskId?: number | null
    escrowId?: number | null
  },
) {
  if (input.amount <= 0) return null

  const admin = await getOrCreatePlatformAdmin(tx)

  await tx.internalBalance.upsert({
    where: { userId: admin.id },
    update: { availableBalance: { increment: input.amount } },
    create: { userId: admin.id, availableBalance: input.amount, pendingBalance: 0, reservedBalance: 0 },
  })

  return tx.transaction.create({
    data: {
      userId: admin.id,
      txid: input.txid,
      type: "platform_fee",
      amount: input.amount,
      fee: 0,
      confirmations: 0,
      status: "completed",
      address: PLATFORM_REVENUE_ADDRESS,
      taskId: input.taskId ?? null,
      escrowId: input.escrowId ?? null,
    },
  })
}
