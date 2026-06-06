import { prisma } from "@/lib/server/prisma"
import { randomToken } from "@/lib/server/tokens"

export async function ensureUserSettings(userId: number) {
  return prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      emailNotifications: true,
      pushNotifications: true,
      taskUpdates: true,
      paymentAlerts: true,
      notificationSound: true,
      marketing: false,
      twoFactorEnabled: false,
    },
  })
}

export async function getUserSettings(userId: number) {
  return ensureUserSettings(userId)
}

export async function updateUserSettings(userId: number, data: Partial<{
  emailNotifications: boolean
  pushNotifications: boolean
  taskUpdates: boolean
  paymentAlerts: boolean
  notificationSound: boolean
  marketing: boolean
  twoFactorEnabled: boolean
}>) {
  return prisma.userSettings.upsert({
    where: { userId },
    update: { ...data },
    create: {
      userId,
      emailNotifications: data.emailNotifications ?? true,
      pushNotifications: data.pushNotifications ?? true,
      taskUpdates: data.taskUpdates ?? true,
      paymentAlerts: data.paymentAlerts ?? true,
      notificationSound: data.notificationSound ?? true,
      marketing: data.marketing ?? false,
      twoFactorEnabled: data.twoFactorEnabled ?? false,
    },
  })
}

export async function getApiKeys(userId: number) {
  return prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })
}

export async function createApiKey(userId: number, name?: string) {
  const key = randomToken(32)
  return prisma.apiKey.create({
    data: {
      userId,
      name,
      key,
      revoked: false,
    },
  })
}
