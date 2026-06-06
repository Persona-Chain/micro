import { prisma } from "@/lib/server/prisma"
import { createNotification } from "@/lib/server/dashboard"
import { parseOptionalDate } from "@/lib/server/escrow-validation"
import { ensureUserProfile, recalcReputationForUser } from "@/lib/server/profile"
import { PLATFORM_ESCROW_FEE_PERCENTAGE } from "@/lib/server/admin-analytics"
import { creditPlatformFee } from "@/lib/server/platform-fees"
import { getOrCreateWallet, sendEscrowOnChainPayment } from "@/lib/server/wallet"

function isAdmin(user: { username: string }) {
  return user.username === "admin"
}

async function audit(escrowId: number, userId: number | null, action: string, details?: string) {
  await prisma.escrowAuditLog.create({
    data: { escrowId, userId: userId ?? null, action, details: details ?? null },
  })
}

export async function createEscrowForTask(input: {
  taskId: number
  employerId: number
  milestones?: Array<{ title: string; description?: string; amount: number; dueDate?: string }>
}) {
  const task = await prisma.task.findUnique({
    where: { id: input.taskId },
    select: {
      id: true,
      userId: true,
      status: true,
      rewardAmount: true,
      maxWorkers: true,
      lockedRewardTotal: true,
      autoReleaseAfterDays: true,
    },
  })
  if (!task) throw new Error("Task not found")
  if (task.userId !== input.employerId) throw new Error("Forbidden")

  const required = task.rewardAmount * task.maxWorkers
  if (required <= 0) throw new Error("Task reward is not funded")

  const existing = await prisma.escrow.findUnique({ where: { taskId: task.id }, select: { id: true, status: true } })
  if (existing) return existing

  const alreadyLocked = task.lockedRewardTotal >= required
  const status = alreadyLocked ? "funded" : "pending_funding"

  const created = await prisma.$transaction(async (tx) => {
    const escrow = await tx.escrow.create({
      data: {
        taskId: task.id,
        employerId: input.employerId,
        amount: required,
        feeAmount: 0,
        netAmount: required,
        status,
        fundedAt: alreadyLocked ? new Date() : null,
      },
      select: { id: true, status: true },
    })

    if (input.milestones?.length) {
      const total = input.milestones.reduce((sum, m) => sum + m.amount, 0)
      if (total !== required) throw new Error("Milestones total must equal escrow amount")
      await tx.escrowMilestone.createMany({
        data: input.milestones.map((m, idx) => ({
          escrowId: escrow.id,
          title: m.title,
          description: m.description ?? null,
          amount: m.amount,
          orderIndex: idx + 1,
          status: idx === 0 ? "active" : "pending",
          dueDate: parseOptionalDate(m.dueDate) ?? null,
        })),
      })
    }

    if (alreadyLocked) {
      await tx.escrowTransaction.create({
        data: { escrowId: escrow.id, type: "funding", amount: required, txReference: "internal_reserved" },
      })
      await tx.escrowAuditLog.create({
        data: { escrowId: escrow.id, userId: input.employerId, action: "funded", details: "Funds already reserved" },
      })
    } else {
      await tx.escrowAuditLog.create({
        data: { escrowId: escrow.id, userId: input.employerId, action: "created", details: null },
      })
    }

    return escrow
  })

  await createNotification(input.employerId, "escrow", `Escrow created for task #${input.taskId}.`, `/task/${input.taskId}`)
  return created
}

export async function fundEscrow(escrowId: number, employerId: number) {
  const escrow = await prisma.escrow.findUnique({
    where: { id: escrowId },
    select: { id: true, taskId: true, employerId: true, amount: true, status: true },
  })
  if (!escrow) throw new Error("Escrow not found")
  if (escrow.employerId !== employerId) throw new Error("Forbidden")
  if (escrow.status !== "pending_funding") return escrow

  await prisma.$transaction(async (tx) => {
    const balance = await tx.internalBalance.findUnique({ where: { userId: employerId }, select: { availableBalance: true } })
    const available = balance?.availableBalance ?? 0
    if (available < escrow.amount) throw new Error("Insufficient balance")

    await tx.internalBalance.update({
      where: { userId: employerId },
      data: { availableBalance: { decrement: escrow.amount }, reservedBalance: { increment: escrow.amount } },
    })

    await tx.task.update({ where: { id: escrow.taskId }, data: { lockedRewardTotal: { increment: escrow.amount } } })

    await tx.escrow.update({ where: { id: escrowId }, data: { status: "funded", fundedAt: new Date() } })
    await tx.escrowTransaction.create({
      data: { escrowId, type: "funding", amount: escrow.amount, txReference: "internal_reserved" },
    })
    await tx.escrowAuditLog.create({ data: { escrowId, userId: employerId, action: "funded", details: null } })
  })

  await createNotification(employerId, "escrow", `Escrow funded for task #${escrow.taskId}.`, `/task/${escrow.taskId}`)
  return prisma.escrow.findUnique({ where: { id: escrowId } })
}

export async function getEscrow(escrowId: number, requester: { id: number; username: string }) {
  const escrow = await prisma.escrow.findUnique({
    where: { id: escrowId },
    include: { milestones: { orderBy: { orderIndex: "asc" } }, task: true },
  })
  if (!escrow) throw new Error("Escrow not found")
  if (!isAdmin(requester) && escrow.employerId !== requester.id && escrow.workerId !== requester.id) throw new Error("Forbidden")
  return escrow
}

export async function releaseEscrow(escrowId: number, employerId: number, workerId?: number) {
  const escrow = await prisma.escrow.findUnique({
    where: { id: escrowId },
    include: { task: true },
  })
  if (!escrow) throw new Error("Escrow not found")
  if (escrow.employerId !== employerId) throw new Error("Forbidden")
  if (escrow.status === "disputed") throw new Error("Escrow is disputed")
  if (escrow.status !== "funded" && escrow.status !== "submitted" && escrow.status !== "in_progress") throw new Error("Escrow not releasable")

  const finalWorkerId = workerId ?? escrow.workerId
  if (!finalWorkerId) throw new Error("Missing workerId")

  const workerWallet = await getOrCreateWallet(finalWorkerId)
  if (!workerWallet?.address) throw new Error("Worker wallet not found")

  const amount = escrow.netAmount || escrow.amount
  
  const platformFee = Math.floor(amount * PLATFORM_ESCROW_FEE_PERCENTAGE)
  const workerPayout = amount - platformFee
  
  const payout = await sendEscrowOnChainPayment(employerId, workerWallet.address, workerPayout)
  const payoutTxid = payout.txid

  await prisma.$transaction(async (tx) => {
    const bal = await tx.internalBalance.findUnique({ where: { userId: employerId }, select: { reservedBalance: true } })
    const reserved = bal?.reservedBalance ?? 0
    if (reserved < amount) throw new Error("Insufficient escrow funds")

    // Deduct full amount from employer's reserved balance
    await tx.internalBalance.update({
      where: { userId: employerId },
      data: { reservedBalance: { decrement: amount } },
    })
    
    // Give worker the payout minus platform fee
    await tx.internalBalance.upsert({
      where: { userId: finalWorkerId },
      update: { availableBalance: { increment: workerPayout } },
      create: { userId: finalWorkerId, availableBalance: workerPayout, pendingBalance: 0, reservedBalance: 0 },
    })

    await tx.task.update({ where: { id: escrow.taskId }, data: { lockedRewardTotal: { decrement: amount } } })
    await tx.escrow.update({
      where: { id: escrowId },
      data: { status: "released", releasedAt: new Date(), workerId: finalWorkerId },
    })

    await tx.escrowTransaction.create({
      data: { escrowId, type: "release", amount, txReference: payoutTxid },
    })
    
    // Record worker payout
    await tx.transaction.create({
      data: {
        userId: finalWorkerId,
        txid: payoutTxid,
        type: "payout",
        amount: workerPayout,
        fee: platformFee,
        confirmations: 0,
        status: "confirmed",
        address: workerWallet.address,
        taskId: escrow.taskId,
        escrowId,
      },
    })
    
    await creditPlatformFee(tx, {
      amount: platformFee,
      txid: `${payoutTxid}_fee`,
      taskId: escrow.taskId,
      escrowId,
    })
    
    await tx.escrowAuditLog.create({ data: { escrowId, userId: employerId, action: "released", details: `Worker paid: ${workerPayout}, Platform fee: ${platformFee}` } })
  })

  await createNotification(finalWorkerId, "payment", `Escrow released: ${workerPayout} sats paid for task #${escrow.taskId}.`, `/task/${escrow.taskId}`)
  await createNotification(employerId, "escrow", `Escrow released for task #${escrow.taskId}.`, `/task/${escrow.taskId}`)

  // Best-effort reputation update for worker (completed tasks count is based on paid submissions).
  try {
    await ensureUserProfile(finalWorkerId)
    await recalcReputationForUser(finalWorkerId)
  } catch {
    // ignore
  }

  return { success: true, txid: payoutTxid, amount: workerPayout, platformFee }
}

export async function refundEscrow(escrowId: number, employerId: number) {
  const escrow = await prisma.escrow.findUnique({ where: { id: escrowId } })
  if (!escrow) throw new Error("Escrow not found")
  if (escrow.employerId !== employerId) throw new Error("Forbidden")
  if (escrow.status === "released") throw new Error("Already released")
  if (escrow.status === "disputed") throw new Error("Escrow is disputed")

  const amount = escrow.netAmount || escrow.amount

  await prisma.$transaction(async (tx) => {
    await tx.internalBalance.update({
      where: { userId: employerId },
      data: { reservedBalance: { decrement: amount }, availableBalance: { increment: amount } },
    })
    await tx.task.update({ where: { id: escrow.taskId }, data: { lockedRewardTotal: { decrement: amount } } })
    await tx.escrow.update({ where: { id: escrowId }, data: { status: "refunded", refundedAt: new Date() } })
    await tx.escrowTransaction.create({
      data: { escrowId, type: "refund", amount, txReference: "internal_refund" },
    })
    await tx.escrowAuditLog.create({ data: { escrowId, userId: employerId, action: "refunded", details: null } })
  })

  await createNotification(employerId, "escrow", `Escrow refunded for task #${escrow.taskId}.`, `/task/${escrow.taskId}`)
  return { success: true }
}

export async function releaseMilestone(milestoneId: number, employerId: number) {
  const milestone = await prisma.escrowMilestone.findUnique({
    where: { id: milestoneId },
    include: { escrow: true },
  })
  if (!milestone) throw new Error("Milestone not found")
  if (milestone.escrow.employerId !== employerId) throw new Error("Forbidden")
  if (milestone.escrow.status === "disputed") throw new Error("Escrow is disputed")
  if (milestone.status === "released") return { success: true }

  const workerId = milestone.escrow.workerId
  if (!workerId) throw new Error("Missing workerId")

  const workerWallet = await prisma.wallet.findUnique({ where: { userId: workerId }, select: { address: true } })
  if (!workerWallet?.address) throw new Error("Worker wallet not found")

  const amount = milestone.amount
  
  const platformFee = Math.floor(amount * PLATFORM_ESCROW_FEE_PERCENTAGE)
  const workerPayout = amount - platformFee
  
  const payoutTxid = `milestone_release_${milestoneId}_${Date.now()}`

  await prisma.$transaction(async (tx) => {
    const bal = await tx.internalBalance.findUnique({ where: { userId: employerId }, select: { reservedBalance: true } })
    const reserved = bal?.reservedBalance ?? 0
    if (reserved < amount) throw new Error("Insufficient escrow funds")

    // Deduct full amount from employer's reserved balance
    await tx.internalBalance.update({ where: { userId: employerId }, data: { reservedBalance: { decrement: amount } } })
    
    // Give worker the payout minus platform fee
    await tx.internalBalance.upsert({
      where: { userId: workerId },
      update: { availableBalance: { increment: workerPayout } },
      create: { userId: workerId, availableBalance: workerPayout, pendingBalance: 0, reservedBalance: 0 },
    })
    
    await tx.task.update({ where: { id: milestone.escrow.taskId }, data: { lockedRewardTotal: { decrement: amount } } })

    await tx.escrowMilestone.update({ where: { id: milestoneId }, data: { status: "released" } })
    await tx.escrowTransaction.create({
      data: { escrowId: milestone.escrowId, type: "release", amount, txReference: payoutTxid },
    })
    
    // Record worker payout
    await tx.transaction.create({
      data: {
        userId: workerId,
        txid: payoutTxid,
        type: "payout",
        amount: workerPayout,
        fee: platformFee,
        confirmations: 0,
        status: "confirmed",
        address: workerWallet.address,
        taskId: milestone.escrow.taskId,
        escrowId: milestone.escrowId,
      },
    })
    
    await creditPlatformFee(tx, {
      amount: platformFee,
      txid: `${payoutTxid}_fee`,
      taskId: milestone.escrow.taskId,
      escrowId: milestone.escrowId,
    })

    // Activate next milestone if exists.
    const next = await tx.escrowMilestone.findFirst({
      where: { escrowId: milestone.escrowId, orderIndex: { gt: milestone.orderIndex }, status: "pending" },
      orderBy: { orderIndex: "asc" },
      select: { id: true },
    })
    if (next) {
      await tx.escrowMilestone.update({ where: { id: next.id }, data: { status: "active" } })
    }

    const remaining = await tx.escrowMilestone.count({ where: { escrowId: milestone.escrowId, status: { not: "released" } } })
    if (remaining === 0) {
      await tx.escrow.update({ where: { id: milestone.escrowId }, data: { status: "released", releasedAt: new Date() } })
    }

    await tx.escrowAuditLog.create({
      data: { escrowId: milestone.escrowId, userId: employerId, action: "milestone_released", details: `${milestone.title} - Worker paid: ${workerPayout}, Platform fee: ${platformFee}` },
    })
  })

  await createNotification(workerId, "payment", `Milestone released: ${workerPayout} sats paid for ${milestone.title}.`, `/task/${milestone.escrow.taskId}`)
  await createNotification(employerId, "escrow", `Milestone released for task #${milestone.escrow.taskId}.`, `/task/${milestone.escrow.taskId}`)

  return { success: true, txid: payoutTxid, amount: workerPayout, platformFee }
}

export async function openDispute(escrowId: number, openerId: number, reason: string) {
  const escrow = await prisma.escrow.findUnique({ where: { id: escrowId }, select: { id: true, taskId: true, status: true } })
  if (!escrow) throw new Error("Escrow not found")
  if (escrow.status === "released" || escrow.status === "refunded") throw new Error("Escrow is closed")

  const dispute = await prisma.$transaction(async (tx) => {
    await tx.escrow.update({ where: { id: escrowId }, data: { status: "disputed", disputedAt: new Date() } })
    const d = await tx.dispute.create({
      data: { escrowId, taskId: escrow.taskId, openedBy: openerId, reason, status: "open" },
      select: { id: true },
    })
    await tx.escrowAuditLog.create({ data: { escrowId, userId: openerId, action: "disputed", details: reason } })
    return d
  })

  return dispute
}

export async function addDisputeComment(disputeId: number, userId: number, message: string) {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId }, select: { id: true, escrowId: true } })
  if (!dispute) throw new Error("Dispute not found")
  const comment = await prisma.disputeComment.create({
    data: { disputeId, userId, message },
    select: { id: true, createdAt: true },
  })
  await audit(dispute.escrowId, userId, "dispute_comment", message)
  return comment
}

export async function resolveDispute(disputeId: number, resolver: { id: number; username: string }, input: { winner: "worker" | "employer" | "split"; notes?: string; splitWorkerPercent?: number }) {
  if (!isAdmin(resolver)) throw new Error("Forbidden")

  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { escrow: true },
  })
  if (!dispute) throw new Error("Dispute not found")
  if (dispute.status !== "open" && dispute.status !== "under_review") throw new Error("Dispute already resolved")

  const escrow = dispute.escrow
  const amount = escrow.netAmount || escrow.amount

  await prisma.$transaction(async (tx) => {
    await tx.dispute.update({
      where: { id: disputeId },
      data: { status: "resolved", resolution: input.notes ?? null, resolvedAt: new Date() },
    })

    if (input.winner === "worker") {
      if (!escrow.workerId) throw new Error("Missing workerId")
      const workerWallet = await tx.wallet.findUnique({ where: { userId: escrow.workerId }, select: { address: true } })
      if (!workerWallet?.address) throw new Error("Worker wallet not found")

      await tx.internalBalance.update({ where: { userId: escrow.employerId }, data: { reservedBalance: { decrement: amount } } })
      await tx.internalBalance.upsert({
        where: { userId: escrow.workerId },
        update: { availableBalance: { increment: amount } },
        create: { userId: escrow.workerId, availableBalance: amount, pendingBalance: 0, reservedBalance: 0 },
      })
      await tx.task.update({ where: { id: escrow.taskId }, data: { lockedRewardTotal: { decrement: amount } } })
      await tx.escrow.update({ where: { id: escrow.id }, data: { status: "released", releasedAt: new Date() } })
      await tx.escrowTransaction.create({ data: { escrowId: escrow.id, type: "dispute_adjustment", amount, txReference: "worker_wins" } })
      await tx.transaction.create({
        data: {
          userId: escrow.workerId,
          txid: `dispute_release_${escrow.id}_${Date.now()}`,
          type: "payout",
          amount,
          fee: 0,
          confirmations: 0,
          status: "confirmed",
          address: workerWallet.address,
          taskId: escrow.taskId,
          escrowId: escrow.id,
        },
      })
    } else if (input.winner === "employer") {
      await tx.internalBalance.update({
        where: { userId: escrow.employerId },
        data: { reservedBalance: { decrement: amount }, availableBalance: { increment: amount } },
      })
      await tx.task.update({ where: { id: escrow.taskId }, data: { lockedRewardTotal: { decrement: amount } } })
      await tx.escrow.update({ where: { id: escrow.id }, data: { status: "refunded", refundedAt: new Date() } })
      await tx.escrowTransaction.create({ data: { escrowId: escrow.id, type: "dispute_adjustment", amount, txReference: "employer_wins" } })
    } else {
      if (!escrow.workerId) throw new Error("Missing workerId")
      const pct = input.splitWorkerPercent ?? 50
      const workerAmt = Math.floor((amount * pct) / 100)
      const employerAmt = amount - workerAmt

      const workerWallet = await tx.wallet.findUnique({ where: { userId: escrow.workerId }, select: { address: true } })
      if (!workerWallet?.address) throw new Error("Worker wallet not found")

      await tx.internalBalance.update({
        where: { userId: escrow.employerId },
        data: { reservedBalance: { decrement: amount }, availableBalance: { increment: employerAmt } },
      })
      await tx.internalBalance.upsert({
        where: { userId: escrow.workerId },
        update: { availableBalance: { increment: workerAmt } },
        create: { userId: escrow.workerId, availableBalance: workerAmt, pendingBalance: 0, reservedBalance: 0 },
      })
      await tx.task.update({ where: { id: escrow.taskId }, data: { lockedRewardTotal: { decrement: amount } } })
      await tx.escrow.update({ where: { id: escrow.id }, data: { status: "released", releasedAt: new Date() } })
      await tx.escrowTransaction.create({ data: { escrowId: escrow.id, type: "dispute_adjustment", amount, txReference: `split_${pct}` } })
      await tx.transaction.create({
        data: {
          userId: escrow.workerId,
          txid: `dispute_split_${escrow.id}_${Date.now()}`,
          type: "payout",
          amount: workerAmt,
          fee: 0,
          confirmations: 0,
          status: "confirmed",
          address: workerWallet.address,
          taskId: escrow.taskId,
          escrowId: escrow.id,
        },
      })
    }

    await tx.escrowAuditLog.create({
      data: { escrowId: escrow.id, userId: resolver.id, action: "resolved", details: input.notes ?? null },
    })
  })

  return { success: true }
}

export async function listEscrowsForEmployer(employerId: number) {
  return prisma.escrow.findMany({ where: { employerId }, orderBy: { createdAt: "desc" }, include: { task: true } })
}

export async function listEscrowsForWorker(workerId: number) {
  return prisma.escrow.findMany({ where: { workerId }, orderBy: { createdAt: "desc" }, include: { task: true } })
}

export async function listEscrowsAdmin(requester: { username: string }) {
  if (!isAdmin(requester)) throw new Error("Forbidden")
  return prisma.escrow.findMany({ orderBy: { createdAt: "desc" }, include: { task: true, employer: true, worker: true } })
}

export async function processAutoReleases(requester: { username: string; id: number }) {
  if (!isAdmin(requester)) throw new Error("Forbidden")

  const now = Date.now()
  const candidates = await prisma.escrow.findMany({
    where: { status: "submitted" },
    include: { task: { select: { autoReleaseAfterDays: true } } },
    take: 500,
  })

  let released = 0
  for (const e of candidates) {
    const days = e.task.autoReleaseAfterDays ?? null
    if (!days || !e.fundedAt) continue
    const releaseAt = e.fundedAt.getTime() + days * 24 * 60 * 60 * 1000
    if (now < releaseAt) continue
    try {
      await releaseEscrow(e.id, e.employerId, e.workerId ?? undefined)
      released += 1
    } catch {
      // ignore individual failures
    }
  }

  return { released }
}
