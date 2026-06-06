import { prisma } from "@/lib/server/prisma"
import { mkdir, writeFile, unlink } from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"])

function extFromMime(mime: string) {
  if (mime === "image/png") return ".png"
  if (mime === "image/jpeg") return ".jpg"
  if (mime === "image/webp") return ".webp"
  return ""
}

export async function saveAvatarUpload(userId: number, file: File) {
  if (!ALLOWED.has(file.type)) throw new Error("Unsupported image type")
  if (file.size > MAX_BYTES) throw new Error("File too large (max 5MB)")

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "avatars")
  await mkdir(uploadsDir, { recursive: true })

  const ext = extFromMime(file.type)
  const name = `${userId}_${crypto.randomUUID()}${ext}`
  const diskPath = path.join(uploadsDir, name)
  const publicUrl = `/uploads/avatars/${name}`

  const buf = Buffer.from(await file.arrayBuffer())
  await writeFile(diskPath, buf)

  // Delete old avatar file+row if exists.
  const existing = await prisma.avatar.findUnique({ where: { userId }, select: { filePath: true } })
  if (existing?.filePath) {
    const oldDiskPath = path.join(process.cwd(), "public", existing.filePath.replace(/^\//, ""))
    await unlink(oldDiskPath).catch(() => {})
  }

  await prisma.$transaction(async (tx) => {
    await tx.avatar.upsert({
      where: { userId },
      update: { filePath: publicUrl, uploadedAt: new Date() },
      create: { userId, filePath: publicUrl },
    })
    await tx.userProfile.upsert({
      where: { userId },
      update: { avatarUrl: publicUrl },
      create: {
        userId,
        username: (await tx.user.findUnique({ where: { id: userId }, select: { username: true } }))?.username || `user-${userId}`,
        displayName: null,
        avatarUrl: publicUrl,
      },
    })
  })

  return { avatarUrl: publicUrl }
}

export async function deleteAvatar(userId: number) {
  const existing = await prisma.avatar.findUnique({ where: { userId }, select: { filePath: true } })
  if (existing?.filePath) {
    const diskPath = path.join(process.cwd(), "public", existing.filePath.replace(/^\//, ""))
    await unlink(diskPath).catch(() => {})
  }

  await prisma.$transaction(async (tx) => {
    await tx.avatar.delete({ where: { userId } }).catch(() => {})
    await tx.userProfile.update({ where: { userId }, data: { avatarUrl: null } }).catch(() => {})
  })

  return { success: true }
}

