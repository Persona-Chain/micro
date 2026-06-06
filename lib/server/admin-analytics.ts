import { endOfDay, format, startOfDay, subDays, subMonths } from "date-fns"
import { prisma } from "@/lib/server/prisma"

export const PLATFORM_REVENUE_ADDRESS = "1GReHTAeJe8jKUeCH4qxBXLV6Rp52iFaMd"
export const TASK_CREATION_FEE_USD = 0.01
export const PLATFORM_ESCROW_FEE_PERCENTAGE = 0.1
export const BSV_TO_SATOSHI = 100_000_000
export const BSV_TO_USD_RATE = 100

export interface AdminAnalytics {
  totalUsers: number
  totalUsersGrowth: number
  activeTasks: number
  activeTasksGrowth: number
  revenue30d: number
  revenue30dGrowth: number
  disputes: number
  disputesPercentage: number
  disputesGrowth: number
  revenueAddress: string
  revenueData: Array<{ month: string; revenue: number; revenueUsd: number; tasks: number }>
  categoryData: Array<{ name: string; value: number; color: string }>
  users: Array<{
    id: number
    username: string
    email: string
    displayName: string
    avatarUrl: string | null
    completedTasks: number
    tasksCount: number
    balance: number
    walletAddress: string | null
    reputation: number
    isVerified: boolean
    createdAt: string
  }>
  tasks: Array<{
    id: number
    title: string
    category: string
    reward: number
    applicants: number
    status: string
    createdAt: string
  }>
  disputesList: Array<{
    id: number
    taskId: number
    taskTitle: string
    status: string
    reason: string
    openedBy: string
    createdAt: string
  }>
}

const activeTaskStatuses = ["published", "in_progress", "submitted"]
const categoryColors = ["#F7931A", "#3B82F6", "#10B981", "#8B5CF6", "#EF4444", "#06B6D4", "#F59E0B", "#6B7280"]

function toUsdFromSats(amount: number) {
  return Number(((amount / BSV_TO_SATOSHI) * BSV_TO_USD_RATE).toFixed(2))
}

function calculatePercentageChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

async function getPlatformRevenueSats(startDate: Date, endDate: Date) {
  const admin = await prisma.user.findUnique({ where: { username: "admin" }, select: { id: true } })
  if (!admin) return 0

  const result = await prisma.transaction.aggregate({
    where: {
      type: "platform_fee",
      userId: admin.id,
      createdAt: { gte: startDate, lte: endDate },
    },
    _sum: { amount: true },
  })

  return Number(result._sum.amount ?? 0)
}

async function getRevenueSeries() {
  const now = new Date()
  const months = Array.from({ length: 6 }, (_, index) => subMonths(now, 5 - index))

  return Promise.all(
    months.map(async (month) => {
      const start = startOfDay(new Date(month.getFullYear(), month.getMonth(), 1))
      const end = endOfDay(new Date(month.getFullYear(), month.getMonth() + 1, 0))
      const [revenue, taskCount] = await Promise.all([
        getPlatformRevenueSats(start, end),
        prisma.task.count({ where: { publishedAt: { gte: start, lte: end } } }),
      ])

      return {
        month: format(month, "MMM"),
        revenue,
        revenueUsd: toUsdFromSats(revenue),
        tasks: taskCount,
      }
    }),
  )
}

async function getCategoryData() {
  const categories = await prisma.category.findMany({
    select: {
      name: true,
      _count: {
        select: {
          tasks: {
            where: {
              status: { in: activeTaskStatuses },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  })

  const total = categories.reduce((sum, category) => sum + category._count.tasks, 0)
  if (total === 0) return [{ name: "No tasks yet", value: 100, color: "#6B7280" }]

  return categories
    .filter((category) => category._count.tasks > 0)
    .map((category, index) => ({
      name: category.name,
      value: Number(((category._count.tasks / total) * 100).toFixed(1)),
      color: categoryColors[index % categoryColors.length],
    }))
}

async function getRecentUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      profile: true,
      avatar: true,
      internalBalance: true,
      wallet: true,
      _count: {
        select: {
          tasks: { where: { status: { not: "draft" } } },
          submissions: { where: { status: { in: ["paid", "approved"] } } },
        },
      },
    },
  })

  return users.map((user) => {
    const isAdminUser = user.username === "admin"

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.profile?.displayName || user.username,
      avatarUrl: user.profile?.avatarUrl || user.avatar?.filePath || null,
      completedTasks: user.profile?.totalCompletedTasks || user._count.submissions,
      tasksCount: user._count.tasks,
      balance: user.internalBalance?.availableBalance ?? 0,
      walletAddress: isAdminUser ? PLATFORM_REVENUE_ADDRESS : user.wallet?.address ?? null,
      reputation: user.profile?.reputationScore ?? 0,
      isVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
    }
  })
}

async function getRecentTasks() {
  const taskInclude = {
    category: true,
    _count: { select: { applications: true } },
  } as const

  const tasks = await prisma.task.findMany({
    where: { status: { not: "draft" } },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    take: 20,
    include: taskInclude,
  })

  return tasks.map((task) => ({
    id: task.id,
    title: task.title || `Draft task #${task.id}`,
    category: task.category?.name || "Uncategorized",
    reward: task.rewardAmount,
    applicants: task._count.applications,
    status: task.status,
    createdAt: task.createdAt.toISOString(),
  }))
}

async function getDisputesList() {
  const disputes = await prisma.dispute.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      task: { select: { id: true, title: true } },
      opener: { select: { username: true } },
    },
  })

  return disputes.map((dispute) => ({
    id: dispute.id,
    taskId: dispute.taskId,
    taskTitle: dispute.task?.title || `Task #${dispute.taskId}`,
    status: dispute.status,
    reason: dispute.reason,
    openedBy: dispute.opener.username,
    createdAt: dispute.createdAt.toISOString(),
  }))
}

export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  const now = new Date()
  const current30dStart = startOfDay(subDays(now, 30))
  const current30dEnd = endOfDay(now)
  const previous30dStart = startOfDay(subDays(now, 60))
  const previous30dEnd = endOfDay(subDays(now, 30))
  const currentMonthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
  const previousMonthStart = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const previousMonthEnd = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0))

  const [
    totalUsers,
    usersThisMonth,
    usersPreviousMonth,
    activeTasks,
    activeTasksThisMonth,
    activeTasksPreviousMonth,
    revenue30dSats,
    previousRevenue30dSats,
    disputesThisMonth,
    disputesPreviousMonth,
    totalDisputes,
    revenueData,
    categoryData,
    users,
    tasks,
    disputesList,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: currentMonthStart, lte: current30dEnd } } }),
    prisma.user.count({ where: { createdAt: { gte: previousMonthStart, lte: previousMonthEnd } } }),
    prisma.task.count({ where: { status: { in: activeTaskStatuses } } }),
    prisma.task.count({ where: { status: { in: activeTaskStatuses }, updatedAt: { gte: currentMonthStart, lte: current30dEnd } } }),
    prisma.task.count({ where: { status: { in: activeTaskStatuses }, updatedAt: { gte: previousMonthStart, lte: previousMonthEnd } } }),
    getPlatformRevenueSats(current30dStart, current30dEnd),
    getPlatformRevenueSats(previous30dStart, previous30dEnd),
    prisma.dispute.count({ where: { createdAt: { gte: currentMonthStart, lte: current30dEnd } } }),
    prisma.dispute.count({ where: { createdAt: { gte: previousMonthStart, lte: previousMonthEnd } } }),
    prisma.dispute.count(),
    getRevenueSeries(),
    getCategoryData(),
    getRecentUsers(),
    getRecentTasks(),
    getDisputesList(),
  ])
  return {
    totalUsers,
    totalUsersGrowth: calculatePercentageChange(usersThisMonth, usersPreviousMonth),
    activeTasks,
    activeTasksGrowth: calculatePercentageChange(activeTasksThisMonth, activeTasksPreviousMonth),
    revenue30d: toUsdFromSats(revenue30dSats),
    revenue30dGrowth: calculatePercentageChange(revenue30dSats, previousRevenue30dSats),
    disputes: totalDisputes,
    disputesPercentage: totalUsers > 0 ? (totalDisputes / totalUsers) * 100 : 0,
    disputesGrowth: calculatePercentageChange(disputesThisMonth, disputesPreviousMonth),
    revenueAddress: PLATFORM_REVENUE_ADDRESS,
    revenueData,
    categoryData,
    users,
    tasks,
    disputesList,
  }
}
