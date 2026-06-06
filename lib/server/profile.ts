import { prisma } from "@/lib/server/prisma"

export async function ensureUserProfile(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true } })
  if (!user) throw new Error("User not found")

  const existing = await prisma.userProfile.findUnique({ where: { userId }, select: { id: true } })
  if (existing) return existing

  return prisma.userProfile.create({
    data: {
      userId,
      username: user.username,
      displayName: user.username,
      bio: "",
      location: "",
      website: "",
      github: "",
      twitter: "",
      avatarUrl: null,
      reputationScore: 0,
      averageRating: 0,
      totalReviews: 0,
      totalCompletedTasks: 0,
    },
    select: { id: true },
  })
}

export async function getPublicProfileByUsername(username: string) {
  let profile = await prisma.userProfile.findUnique({
    where: { username },
    include: { user: { select: { id: true, username: true, createdAt: true } } },
  })

  if (!profile) {
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true, username: true, createdAt: true } })
    if (!user) return null
    await ensureUserProfile(user.id)
    profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      include: { user: { select: { id: true, username: true, createdAt: true } } },
    })
    if (!profile) return null
  }

  const [portfolio, reviews] = await Promise.all([
    prisma.portfolioProject.findMany({
      where: { userId: profile.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.review.findMany({
      where: { targetUserId: profile.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { reviewer: { select: { username: true } }, task: { select: { id: true, title: true } } },
    }),
  ])

  return { profile, portfolio, reviews }
}

export async function getProfileStatsByUsername(username: string) {
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true } })
  if (!user) return null

  const [paidSubmissions, earned, avgRating, totalReviews, positiveReviews, activeApplications, activeEmployerTasks] =
    await Promise.all([
      prisma.taskSubmission.count({ where: { userId: user.id, status: "paid" } }),
      prisma.transaction.aggregate({
        where: { userId: user.id, type: "payout" },
        _sum: { amount: true },
      }),
      prisma.review.aggregate({ where: { targetUserId: user.id }, _avg: { rating: true } }),
      prisma.review.count({ where: { targetUserId: user.id } }),
      prisma.review.count({ where: { targetUserId: user.id, rating: { gte: 4 } } }),
      prisma.taskApplication.count({ where: { userId: user.id, status: "applied" } }),
      prisma.task.count({ where: { userId: user.id, status: "published" } }),
    ])

  const averageRating = Number(avgRating._avg.rating ?? 0)
  const completedTasks = paidSubmissions
  const reputationScore = Math.round(completedTasks * 10 + averageRating * 20 + positiveReviews * 5)
  const totalEarnedSats = Number(earned._sum.amount ?? 0)

  return {
    completedTasks,
    activeTasks: activeApplications + activeEmployerTasks,
    totalEarnedSats,
    averageRating,
    totalReviews,
    reputationScore,
  }
}

export async function getProfileTasksByUsername(username: string) {
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true, username: true } })
  if (!user) return null

  const [created, completedSubmissions] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id, status: { in: ["published", "completed"] } },
      orderBy: { publishedAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        shortDescription: true,
        rewardAmount: true,
        status: true,
        createdAt: true,
        publishedAt: true,
      },
    }),
    prisma.taskSubmission.findMany({
      where: { userId: user.id, status: "paid" },
      orderBy: { paidAt: "desc" },
      take: 50,
      select: {
        id: true,
        paidAt: true,
        task: { select: { id: true, title: true, rewardAmount: true, status: true, createdAt: true, publishedAt: true } },
      },
    }),
  ])

  const completed = completedSubmissions
    .map((s) => s.task)
    .filter(Boolean)
    .map((t) => ({
      id: t.id,
      title: t.title || "",
      rewardAmount: t.rewardAmount,
      status: t.status,
      createdAt: (t.publishedAt || t.createdAt).toISOString(),
      role: "worker" as const,
    }))

  const createdMapped = created.map((t) => ({
    id: t.id,
    title: t.title || "",
    rewardAmount: t.rewardAmount,
    status: t.status,
    createdAt: (t.publishedAt || t.createdAt).toISOString(),
    role: "employer" as const,
  }))

  return { created: createdMapped, completed }
}

export async function recalcReputationForUser(userId: number) {
  const profile = await prisma.userProfile.findUnique({ where: { userId }, select: { userId: true } })
  if (!profile) return

  const [completedTasks, avg, total, positive] = await Promise.all([
    prisma.taskSubmission.count({ where: { userId, status: "paid" } }),
    prisma.review.aggregate({ where: { targetUserId: userId }, _avg: { rating: true } }),
    prisma.review.count({ where: { targetUserId: userId } }),
    prisma.review.count({ where: { targetUserId: userId, rating: { gte: 4 } } }),
  ])

  const averageRating = Number(avg._avg.rating ?? 0)
  const reputationScore = Math.round(completedTasks * 10 + averageRating * 20 + positive * 5)

  await prisma.userProfile.update({
    where: { userId },
    data: {
      totalCompletedTasks: completedTasks,
      averageRating,
      totalReviews: total,
      reputationScore,
    },
  })
}
