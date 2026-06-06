import { format, startOfDay, subDays, addDays } from "date-fns"
import { prisma } from "@/lib/server/prisma"

const CACHE_TTL = 60_000
const cache = new Map<string, { expiresAt: number; value: unknown }>()

function toBsv(amount: number) {
  return Number((amount / 100_000_000).toFixed(8))
}

function getCacheKey(key: string) {
  return `dashboard:${key}`
}

async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const cacheKey = getCacheKey(key)
  const now = Date.now()
  const entry = cache.get(cacheKey)
  if (entry && entry.expiresAt > now) {
    return entry.value as T
  }

  const value = await loader()
  cache.set(cacheKey, { value, expiresAt: now + CACHE_TTL })
  return value
}

export function normalizeTransactionStatus(tx: { status: string; type: string; confirmations?: number | null; createdAt: Date }) {
  if (tx.status === "failed" || tx.status === "rejected") return tx.status
  if (tx.status === "confirmed" || tx.status === "completed" || tx.status === "broadcast") return "completed"
  if ((tx.confirmations ?? 0) > 0) return "completed"
  if (["deposit", "withdrawal", "payout", "platform_fee", "task_creation_fee", "platform_fee_paid", "paymail_receive", "paymail_send", "earning"].includes(tx.type)) return "completed"
  if (Date.now() - tx.createdAt.getTime() > 24 * 60 * 60 * 1000) return "completed"
  return tx.status || "pending"
}

function getRangeDays(range: "7d" | "30d" | "90d") {
  switch (range) {
    case "7d":
      return 7
    case "30d":
      return 30
    case "90d":
      return 90
    default:
      return 30
  }
}

function buildDateSeries(startDate: Date, count: number) {
  return Array.from({ length: count }, (_, index) => format(addDays(startDate, index), "yyyy-MM-dd"))
}

export async function getWalletSummary(userId: number) {
  return cached(`wallet-summary:${userId}`, async () => {
    const balance = await prisma.internalBalance.findUnique({ where: { userId } })

    const depositTotals = await prisma.transaction.aggregate({
      where: { userId, type: "deposit" },
      _sum: { amount: true },
    })
    const withdrawalTotals = await prisma.transaction.aggregate({
      where: { userId, type: "withdrawal" },
      _sum: { amount: true },
    })

    return {
      availableBalance: toBsv(balance?.availableBalance ?? 0),
      pendingBalance: toBsv(balance?.pendingBalance ?? 0),
      lockedBalance: toBsv(balance?.reservedBalance ?? 0),
      totalDeposits: toBsv(Number(depositTotals._sum.amount ?? 0)),
      totalWithdrawals: toBsv(Number(withdrawalTotals._sum.amount ?? 0)),
    }
  })
}

export async function getEarningsChart(userId: number, range: "7d" | "30d" | "90d") {
  const days = getRangeDays(range)
  const startDate = startOfDay(subDays(new Date(), days - 1))
  const dates = buildDateSeries(startDate, days)

  const snapshots = await prisma.earningsSnapshot.findMany({
    where: {
      userId,
      period: "daily",
      date: { gte: startDate },
    },
    orderBy: { date: "asc" },
  })

  if (snapshots.length > 0) {
    const snapshotMap = new Map(snapshots.map((snapshot) => [format(snapshot.date, "yyyy-MM-dd"), snapshot.amount]))
    return dates.map((date) => ({ date, earnings: toBsv(snapshotMap.get(date) ?? 0) }))
  }

  const payouts = await prisma.transaction.findMany({
    where: {
      userId,
      type: "payout",
      createdAt: { gte: startDate },
    },
    select: { amount: true, createdAt: true },
  })

  const dailyEarnings = payouts.reduce((acc, tx) => {
    const day = format(tx.createdAt, "yyyy-MM-dd")
    acc[day] = (acc[day] ?? 0) + tx.amount
    return acc
  }, {} as Record<string, number>)

  return dates.map((date) => ({ date, earnings: toBsv(dailyEarnings[date] ?? 0) }))
}

export async function getTaskSummary(userId: number) {
  const [draftTasks, employerActive, employerCompleted, employerPending, workerAccepted, workerCompleted, workerPending] =
    await Promise.all([
      prisma.task.count({ where: { userId, status: "draft" } }),
      prisma.task.count({ where: { userId, status: { in: ["published", "in_progress", "submitted"] } } }),
      prisma.task.count({ where: { userId, status: "completed" } }),
      prisma.task.count({ where: { userId, status: { in: ["pending", "submitted"] } } }),
      prisma.taskApplication.count({ where: { userId, status: "accepted" } }),
      prisma.taskSubmission.count({ where: { userId, status: "paid" } }),
      prisma.taskSubmission.count({ where: { userId, status: "submitted" } }),
    ])

  const employerScore = employerActive + employerCompleted + employerPending
  const workerScore = workerAccepted + workerCompleted + workerPending

  if (workerScore >= employerScore) {
    return {
      activeTasks: workerAccepted,
      completedTasks: workerCompleted,
      pendingTasks: workerPending,
      draftTasks,
    }
  }

  return {
    activeTasks: employerActive,
    completedTasks: employerCompleted,
    pendingTasks: employerPending,
    draftTasks,
  }
}

export async function getActiveTasks(userId: number, limit = 10) {
  const workerTasks = await prisma.task.findMany({
    where: {
      applications: {
        some: {
          userId,
          status: "accepted",
        },
      },
      status: { in: ["published", "in_progress", "submitted"] },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      status: true,
      rewardAmount: true,
    },
  })

  if (workerTasks.length > 0) {
    return workerTasks.map((task) => ({
      id: task.id,
      title: task.title ?? "Untitled task",
      status: task.status,
      reward: task.rewardAmount,
    }))
  }

  const employerTasks = await prisma.task.findMany({
    where: {
      userId,
      status: { in: ["published", "in_progress", "submitted"] },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      status: true,
      rewardAmount: true,
    },
  })

  return employerTasks.map((task) => ({
    id: task.id,
    title: task.title ?? "Untitled task",
    status: task.status,
    reward: task.rewardAmount,
  }))
}

export async function getSubmissionSummary(userId: number) {
  const [submitted, approved, rejected, revisionRequested] = await Promise.all([
    prisma.taskSubmission.count({ where: { userId } }),
    prisma.taskSubmission.count({ where: { userId, status: "approved" } }),
    prisma.taskSubmission.count({ where: { userId, status: "rejected" } }),
    prisma.taskSubmission.count({ where: { userId, status: "revision_requested" } }),
  ])

  return { submitted, approved, rejected, revisionRequested }
}

export async function getTransactionHistory(userId: number, limit = 20) {
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      txid: true,
      type: true,
      amount: true,
      status: true,
      confirmations: true,
      createdAt: true,
      taskId: true,
    },
  })

  return transactions.map((tx) => ({
    txid: tx.txid,
    type: tx.type,
    amount: toBsv(tx.amount),
    status: normalizeTransactionStatus(tx),
    description:
      tx.type === "deposit"
        ? "Deposit received"
        : tx.type === "withdrawal"
        ? "Withdrawal requested"
        : tx.type === "task_creation_fee"
        ? tx.taskId
          ? `Task creation fee (#${tx.taskId})`
          : "Task creation fee"
        : tx.type === "platform_fee_paid"
        ? "Platform fee"
        : tx.type === "payout"
        ? tx.taskId
          ? `Task payout (#${tx.taskId})`
          : "Payout received"
        : "Transaction",
    createdAt: tx.createdAt.toISOString(),
  }))
}

export async function getEscrowSummary(userId: number) {
  const [funded, released, disputed, pendingRelease] = await Promise.all([
    prisma.escrow.count({
      where: {
        OR: [{ employerId: userId }, { workerId: userId }],
        status: "funded",
      },
    }),
    prisma.escrow.count({
      where: {
        OR: [{ employerId: userId }, { workerId: userId }],
        status: "released",
      },
    }),
    prisma.escrow.count({
      where: {
        OR: [{ employerId: userId }, { workerId: userId }],
        status: "disputed",
      },
    }),
    prisma.escrow.count({
      where: {
        OR: [{ employerId: userId }, { workerId: userId }],
        status: { in: ["pending_funding", "submitted", "in_progress"] },
      },
    }),
  ])

  return { funded, released, disputed, pendingRelease }
}

export async function getReputationSummary(userId: number) {
  const profile = await prisma.userProfile.findUnique({ where: { userId } })
  if (profile) {
    return {
      score: profile.reputationScore,
      averageRating: profile.averageRating,
      totalReviews: profile.totalReviews,
      completedTasks: profile.totalCompletedTasks,
    }
  }

  return {
    score: 0,
    averageRating: 0,
    totalReviews: 0,
    completedTasks: 0,
  }
}

export async function getNotifications(userId: number, limit = 20) {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit * 3,
    select: {
      id: true,
      type: true,
      message: true,
      link: true,
      createdAt: true,
      read: true,
    },
  })

  const seen = new Set<string>()
  const unique = []

  for (const notif of notifications) {
    const key = `${notif.type}:${notif.message}:${notif.link ?? ""}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push({
      id: notif.id,
      type: notif.type,
      message: notif.message,
      link: notif.link,
      read: notif.read,
      createdAt: notif.createdAt.toISOString(),
    })
    if (unique.length >= limit) break
  }

  return unique
}

export async function createNotification(userId: number, type: string, message: string, link?: string) {
  const recentWindow = new Date(Date.now() - 60 * 60 * 1000)
  const linkValue = link ?? null
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type,
      message,
      link: linkValue,
      createdAt: { gte: recentWindow },
    },
    orderBy: { createdAt: "desc" },
  })

  if (existing) return existing

  const created = await prisma.notification.create({
    data: {
      userId,
      type,
      message,
      link: linkValue,
    },
  })

  await prisma.notification.deleteMany({
    where: {
      userId,
      type,
      message,
      link: linkValue,
      createdAt: { gte: recentWindow },
      id: { not: created.id },
    },
  })

  return created
}

export async function getStats(userId: number) {
  const monthStart = startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1))

  const [earned, spent, tasksCompleted, tasksCreated, newReviews] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        userId,
        type: "payout",
        createdAt: { gte: monthStart },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        userId,
        type: { in: ["withdrawal", "payout"] },
        createdAt: { gte: monthStart },
      },
      _sum: { amount: true },
    }),
    prisma.taskSubmission.count({ where: { userId, status: "paid", updatedAt: { gte: monthStart } } }),
    prisma.task.count({ where: { userId, createdAt: { gte: monthStart } } }),
    prisma.review.count({ where: { targetUserId: userId, createdAt: { gte: monthStart } } }),
  ])

  return {
    earnedThisMonth: toBsv(Number(earned._sum.amount ?? 0)),
    spentThisMonth: toBsv(Number(spent._sum.amount ?? 0)),
    tasksCompleted,
    tasksCreated,
    newReviews,
  }
}

export async function getActivityFeed(userId: number, limit = 20) {
  const items = await prisma.activityFeed.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      type: true,
      referenceId: true,
      message: true,
      createdAt: true,
    },
  })

  return items.map((item) => ({
    type: item.type,
    referenceId: item.referenceId,
    message: item.message,
    createdAt: item.createdAt.toISOString(),
  }))
}

export async function getTopTasks(userId: number, limit = 10) {
  const [employerTasks, workerTasks] = await Promise.all([
    prisma.task.findMany({
      where: { userId },
      include: {
        payments: {
          where: { type: "payout" },
          select: { amount: true },
        },
      },
    }),
    prisma.task.findMany({
      where: {
        submissions: {
          some: { userId, status: "paid" },
        },
      },
      include: {
        payments: {
          where: { userId },
          select: { amount: true },
        },
      },
    }),
  ])

  const normalized = [
    ...employerTasks.map((task) => ({
      title: task.title ?? "Untitled task",
      earned: toBsv(task.payments.reduce((sum, tx) => sum + tx.amount, 0)),
    })),
    ...workerTasks.map((task) => ({
      title: task.title ?? "Untitled task",
      earned: toBsv(task.payments.reduce((sum, tx) => sum + tx.amount, 0)),
    })),
  ]

  return normalized
    .sort((a, b) => b.earned - a.earned)
    .slice(0, limit)
}

export async function getDashboardOverview(userId: number) {
  const [wallet, earnings, tasks, transactions, submissions, escrows, reputation, notifications, activeTasks] = await Promise.all([
    getWalletSummary(userId),
    getEarningsChart(userId, "30d"),
    getTaskSummary(userId),
    getTransactionHistory(userId, 5),
    getSubmissionSummary(userId),
    getEscrowSummary(userId),
    getReputationSummary(userId),
    getNotifications(userId, 5),
    getActiveTasks(userId, 5),
  ])

  return {
    wallet,
    earnings: { chart: earnings },
    tasks,
    transactions,
    submissions,
    escrows,
    reputation,
    notifications,
    activeTasks,
  }
}
