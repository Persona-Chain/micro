import { prisma } from "@/lib/server/prisma"

export async function getPlatformStats() {
  const [totalUsers, totalTasks, earnings, ratings] = await Promise.all([
    prisma.user.count(),
    prisma.task.count({ where: { status: { not: "draft" } } }),
    prisma.transaction.aggregate({
      where: { type: "payout", status: { in: ["confirmed", "completed"] } },
      _sum: { amount: true },
    }),
    prisma.review.aggregate({
      _avg: { rating: true },
    }),
  ])

  return {
    totalUsers,
    totalTasks,
    totalEarned: Number(earnings._sum.amount ?? 0),
    avgRating: Number((ratings._avg.rating ?? 0).toFixed(1)),
  }
}
