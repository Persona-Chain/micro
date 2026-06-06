import { prisma } from "@/lib/server/prisma"
import { createNotification } from "@/lib/server/dashboard"
import { createEscrowForTask, fundEscrow, releaseEscrow } from "@/lib/server/escrow"

function makeInternalTxid(prefix: string, taskId: number, extra?: string) {
  return `${prefix}_${taskId}_${Date.now()}${extra ? `_${extra}` : ""}`
}

export async function submitWork(taskId: number, userId: number, message: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, status: true, userId: true },
  })
  if (!task || task.status !== "published") throw new Error("Task not found")

  const application = await prisma.taskApplication.findUnique({
    where: { taskId_userId: { taskId, userId } },
    select: { id: true, status: true },
  })
  if (!application) throw new Error("You must apply before submitting work")

  const submission = await prisma.taskSubmission.create({
    data: { taskId, userId, message, status: "submitted" },
    select: { id: true, status: true, createdAt: true },
  })

  await createNotification(task.userId, "task", `New work submitted for task #${taskId}.`, `/task/${taskId}`)
  await createNotification(userId, "task", `Your submission for task #${taskId} was received.`, `/task/${taskId}`)

  return { id: submission.id, status: submission.status, createdAt: submission.createdAt.toISOString() }
}

export async function listSubmissionsForTask(taskId: number, requesterId: number) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, userId: true, status: true, rewardAmount: true, currency: true },
  })
  if (!task || task.status !== "published") throw new Error("Task not found")

  const isOwner = task.userId === requesterId
  if (!isOwner) {
    // Non-owners can only see their own submissions.
    return prisma.taskSubmission.findMany({
      where: { taskId, userId: requesterId },
      orderBy: { createdAt: "desc" },
      select: { id: true, message: true, status: true, createdAt: true, decidedAt: true, paidAt: true },
    })
  }

  return prisma.taskSubmission.findMany({
    where: { taskId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      message: true,
      status: true,
      createdAt: true,
      decidedAt: true,
      paidAt: true,
      user: { select: { id: true, username: true } },
    },
  })
}

export async function approveSubmissionAndPay(taskId: number, ownerId: number, submissionId: number) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      userId: true,
      status: true,
      rewardAmount: true,
      currency: true,
      lockedRewardTotal: true,
      maxWorkers: true,
    },
  })
  if (!task || task.status !== "published") throw new Error("Task not found")
  if (task.userId !== ownerId) throw new Error("Forbidden")

  const submission = await prisma.taskSubmission.findFirst({
    where: { id: submissionId, taskId },
    select: { id: true, userId: true, status: true, payoutTxid: true },
  })
  if (!submission) throw new Error("Submission not found")
  if (submission.status === "paid") throw new Error("Already paid")

  // Ensure escrow exists for this task and is funded.
  const escrowExisting = await prisma.escrow.findUnique({ where: { taskId }, select: { id: true, status: true } })
  const escrow =
    escrowExisting ??
    (await createEscrowForTask({
      taskId,
      employerId: ownerId,
    }))

  if (escrow.status === "pending_funding") {
    await fundEscrow(escrow.id, ownerId)
  }

  // Release the escrow to the submission's worker.
  const release = await releaseEscrow(escrow.id, ownerId, submission.userId)

  const txid = typeof release?.txid === "string" ? release.txid : makeInternalTxid("payout", taskId, String(submissionId))
  await prisma.taskSubmission.update({
    where: { id: submissionId },
    data: { status: "paid", decidedAt: new Date(), paidAt: new Date(), payoutTxid: txid },
  })

  await createNotification(submission.userId, "payment", `Your submission for task #${taskId} was approved and paid.`, `/task/${taskId}`)
  await createNotification(ownerId, "escrow", `Payment released for submission #${submissionId} on task #${taskId}.`, `/task/${taskId}`)

  return { success: true, txid, amount: task.rewardAmount, currency: task.currency }
}
