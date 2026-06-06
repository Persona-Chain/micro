import { subDays } from "date-fns"
import { prisma } from "@/lib/server/prisma"

export type LeaderboardRange = "weekly" | "monthly" | "allTime"

function getRangeStart(range: LeaderboardRange) {
  const now = new Date()
  if (range === "weekly") return subDays(now, 7)
  if (range === "monthly") return subDays(now, 30)
  return undefined
}

export async function getTopEarners(range: LeaderboardRange) {
  const since = getRangeStart(range)
  const earnings = await prisma.transaction.groupBy({
    by: ["userId"],
    where: {
      type: "payout",
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 10,
  })

  if (!earnings.length) return []

  const users = await prisma.user.findMany({
    where: { id: { in: earnings.map((item) => item.userId) } },
    include: { profile: true },
  })

  const userMap = new Map(users.map((user) => [user.id, user]))

  return earnings
    .map((item) => {
      const user = userMap.get(item.userId)
      if (!user) return null
      return {
        id: user.id,
        username: user.username,
        displayName: user.profile?.displayName || user.username,
        avatarUrl: user.profile?.avatarUrl || null,
        totalEarnedSats: Number(item._sum.amount ?? 0),
        completedTasks: user.profile?.totalCompletedTasks ?? 0,
        reputation: user.profile?.reputationScore ?? 0,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
}

export async function getTopEmployers(range: LeaderboardRange) {
  const since = getRangeStart(range)
  const employerStats = await prisma.task.groupBy({
    by: ["userId"],
    where: {
      status: "completed",
      ...(since ? { updatedAt: { gte: since } } : {}),
    },
    _sum: { rewardAmount: true },
    _count: { id: true },
    orderBy: { _sum: { rewardAmount: "desc" } },
    take: 10,
  })

  if (!employerStats.length) return []

  const users = await prisma.user.findMany({
    where: { id: { in: employerStats.map((item) => item.userId) } },
    include: { profile: true },
  })

  const userMap = new Map(users.map((user) => [user.id, user]))

  return employerStats
    .map((item) => {
      const user = userMap.get(item.userId)
      if (!user) return null
      return {
        id: user.id,
        username: user.username,
        displayName: user.profile?.displayName || user.username,
        avatarUrl: user.profile?.avatarUrl || null,
        totalSpentSats: Number(item._sum.rewardAmount ?? 0),
        tasksCreated: item._count.id,
        reputation: user.profile?.reputationScore ?? 0,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
}

export async function getTopReputation() {
  const profiles = await prisma.userProfile.findMany({
    orderBy: { reputationScore: "desc" },
    take: 10,
    include: { user: { select: { username: true } } },
  })

  return profiles.map((profile) => ({
    id: profile.userId,
    username: profile.user.username,
    displayName: profile.displayName || profile.user.username,
    avatarUrl: profile.avatarUrl || null,
    reputation: profile.reputationScore,
    completedTasks: profile.totalCompletedTasks,
  }))
}
