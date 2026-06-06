import { PrismaClient } from "@prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import bcrypt from "bcryptjs"

const datasourceUrl = process.env.DATABASE_URL || "file:./dev.db"
const adapter = new PrismaBetterSqlite3({ url: datasourceUrl })
const prisma = new PrismaClient({ adapter })

async function main() {
  const adminPasswordHash = await bcrypt.hash("Admin123!", 12)
  const testPasswordHash = await bcrypt.hash("Test123!", 12)

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      username: "admin",
      email: "admin@example.com",
      passwordHash: adminPasswordHash,
      emailVerified: true,
      verificationToken: null,
      resetToken: null,
    },
  })

  await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      username: "test",
      email: "test@example.com",
      passwordHash: testPasswordHash,
      emailVerified: true,
      verificationToken: null,
      resetToken: null,
    },
  })

  // Give seed users some starting funds for demos (1 BSV confirmed).
  const oneBsv = 100_000_000
  await prisma.internalBalance.upsert({
    where: { userId: 1 },
    update: { availableBalance: oneBsv },
    create: { userId: 1, availableBalance: oneBsv, pendingBalance: 0, reservedBalance: 0 },
  })
  await prisma.internalBalance.upsert({
    where: { userId: 2 },
    update: { availableBalance: oneBsv },
    create: { userId: 2, availableBalance: oneBsv, pendingBalance: 0, reservedBalance: 0 },
  })

  const categories = [
    { name: "Social Media", icon: "📣" },
    { name: "Development", icon: "💻" },
    { name: "Translation", icon: "🌍" },
    { name: "Design", icon: "🎨" },
    { name: "Writing", icon: "✍️" },
    { name: "Marketing", icon: "📈" },
    { name: "Research", icon: "🔎" },
    { name: "Blockchain", icon: "⛓️" },
  ]

  for (const c of categories) {
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")
    await prisma.category.upsert({
      where: { slug },
      update: { name: c.name, icon: c.icon },
      create: { name: c.name, slug, icon: c.icon },
    })
  }

  await prisma.userProfile.upsert({
    where: { userId: 1 },
    update: {
      displayName: "Admin User",
      bio: "Platform administrator and escrow manager.",
      reputationScore: 1800,
      averageRating: 4.9,
      totalReviews: 12,
      totalCompletedTasks: 22,
    },
    create: {
      userId: 1,
      username: "admin",
      displayName: "Admin User",
      bio: "Platform administrator and escrow manager.",
      location: "Global",
      website: "https://bountybee.example.com",
      github: "admin",
      twitter: "@bountybee",
      avatarUrl: null,
      reputationScore: 1800,
      averageRating: 4.9,
      totalReviews: 12,
      totalCompletedTasks: 22,
    },
  })

  await prisma.userProfile.upsert({
    where: { userId: 2 },
    update: {
      displayName: "Test Freelancer",
      bio: "Experienced Bitcoin micro-job freelancer.",
      reputationScore: 1260,
      averageRating: 4.8,
      totalReviews: 34,
      totalCompletedTasks: 18,
    },
    create: {
      userId: 2,
      username: "test",
      displayName: "Test Freelancer",
      bio: "Experienced Bitcoin micro-job freelancer.",
      location: "Remote",
      website: "https://test.example.com",
      github: "test",
      twitter: "@test",
      avatarUrl: null,
      reputationScore: 1260,
      averageRating: 4.8,
      totalReviews: 34,
      totalCompletedTasks: 18,
    },
  })

  const recentDates = [0, 1, 2, 3, 4, 5, 6].map((daysAgo) => {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() - daysAgo)
    return date
  })

  for (const [index, date] of recentDates.entries()) {
    await prisma.earningsSnapshot.upsert({
      where: {
        userId_period_date: {
          userId: 2,
          period: "daily",
          date,
        },
      },
      update: { amount: 800_000 + index * 50_000 },
      create: {
        userId: 2,
        amount: 800_000 + index * 50_000,
        period: "daily",
        date,
      },
    })
  }

  await prisma.notification.createMany({
    data: [
      {
        userId: 2,
        type: "submission_approved",
        message: "Your task submission was approved.",
        link: "/dashboard/tasks",
        read: false,
      },
      {
        userId: 2,
        type: "escrow_funded",
        message: "An escrow was funded for your active gig.",
        link: "/dashboard/escrows",
        read: false,
      },
      {
        userId: 2,
        type: "review_received",
        message: "You received a new review from an employer.",
        link: "/dashboard/reviews",
        read: true,
      },
    ],
  })

  await prisma.activityFeed.createMany({
    data: [
      {
        userId: 2,
        type: "submission_created",
        referenceId: "1",
        message: "Submitted work for the Bitcoin landing page task.",
      },
      {
        userId: 2,
        type: "submission_approved",
        referenceId: "1",
        message: "Your submission was approved and payout is in progress.",
      },
      {
        userId: 2,
        type: "review_received",
        referenceId: "1",
        message: "Received a 5-star review from a client.",
      },
    ],
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
