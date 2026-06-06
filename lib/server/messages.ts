import { prisma } from "@/lib/server/prisma"
import { createNotification } from "@/lib/server/dashboard"

type UserPreview = {
  id: number
  username: string
  profile: { displayName: string | null; avatarUrl: string | null } | null
  avatar: { filePath: string } | null
}

function serializeUser(user: UserPreview) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.profile?.displayName || user.username,
    avatarUrl: user.profile?.avatarUrl || user.avatar?.filePath || null,
  }
}

function serializeMessage(message: {
  id: number
  conversationId: number
  senderId: number
  content: string
  readAt: Date | null
  createdAt: Date
}) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.content,
    read: Boolean(message.readAt),
    readAt: message.readAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
  }
}

export async function listConversations(userId: number) {
  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
    include: {
      participants: {
        include: {
          user: { include: { profile: true, avatar: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  return Promise.all(
    conversations.map(async (conversation) => {
      const otherParticipants = conversation.participants
        .filter((participant) => participant.userId !== userId)
        .map((participant) => serializeUser(participant.user))
      const lastMessage = conversation.messages[0] ?? null
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conversation.id,
          senderId: { not: userId },
          readAt: null,
        },
      })

      return {
        id: conversation.id,
        type: conversation.type,
        participants: conversation.participants.map((participant) => serializeUser(participant.user)),
        otherParticipants,
        lastMessage: lastMessage ? serializeMessage(lastMessage) : null,
        unreadCount,
        updatedAt: conversation.updatedAt.toISOString(),
      }
    }),
  )
}

export async function getConversationForUser(conversationId: number, userId: number) {
  return prisma.conversation.findFirst({
    where: { id: conversationId, participants: { some: { userId } } },
    include: {
      participants: {
        include: {
          user: { include: { profile: true, avatar: true } },
        },
      },
    },
  })
}

export async function listMessages(conversationId: number, userId: number, afterId?: number) {
  const conversation = await getConversationForUser(conversationId, userId)
  if (!conversation) throw new Error("Conversation not found")

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      id: afterId ? { gt: afterId } : undefined,
    },
    orderBy: { createdAt: "asc" },
    take: afterId ? 100 : 200,
  })

  await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: userId },
      readAt: null,
    },
    data: { readAt: new Date() },
  })
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  })

  return {
    conversation: {
      id: conversation.id,
      type: conversation.type,
      participants: conversation.participants.map((participant) => serializeUser(participant.user)),
      otherParticipants: conversation.participants
        .filter((participant) => participant.userId !== userId)
        .map((participant) => serializeUser(participant.user)),
      updatedAt: conversation.updatedAt.toISOString(),
    },
    messages: messages.map(serializeMessage),
  }
}

export async function sendMessage(conversationId: number, senderId: number, content: string) {
  const trimmed = content.trim()
  if (!trimmed) throw new Error("Message cannot be empty")
  if (trimmed.length > 4000) throw new Error("Message is too long")

  const conversation = await getConversationForUser(conversationId, senderId)
  if (!conversation) throw new Error("Conversation not found")

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId,
        senderId,
        content: trimmed,
      },
    })
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })
    await tx.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: senderId } },
      data: { lastReadAt: new Date() },
    })
    return created
  })

  const sender = conversation.participants.find((participant) => participant.userId === senderId)?.user
  const senderName = sender?.profile?.displayName || sender?.username || "Someone"
  const recipients = conversation.participants.filter((participant) => participant.userId !== senderId)
  await Promise.all(
    recipients.map((recipient) =>
      createNotification(
        recipient.userId,
        "message",
        `New message from ${senderName}`,
        `/messages?user=${encodeURIComponent(sender?.username || "")}`,
      ),
    ),
  )

  return serializeMessage(message)
}

export async function findOrCreateDirectConversation(userId: number, recipientId: number, initialMessage?: string) {
  if (userId === recipientId) throw new Error("You cannot message yourself")

  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true },
  })
  if (!recipient) throw new Error("Recipient not found")

  const existingLinks = await prisma.conversationParticipant.findMany({
    where: {
      userId,
      conversation: {
        type: "direct",
        participants: { some: { userId: recipientId } },
      },
    },
    select: { conversationId: true },
  })
  const existingIds = existingLinks.map((link) => link.conversationId)
  const existing = existingIds.length
    ? await prisma.conversation.findFirst({
        where: {
          id: { in: existingIds },
          participants: { every: { userId: { in: [userId, recipientId] } } },
        },
      })
    : null

  const conversation =
    existing ??
    (await prisma.conversation.create({
      data: {
        type: "direct",
        participants: {
          create: [{ userId }, { userId: recipientId }],
        },
      },
    }))

  if (initialMessage?.trim()) {
    await sendMessage(conversation.id, userId, initialMessage)
  }

  return conversation
}

export async function searchMessageUsers(userId: number, query: string) {
  const q = query.trim().toLowerCase()
  if (q.length < 1) return []

  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
    },
    include: { profile: true, avatar: true },
    orderBy: { username: "asc" },
    take: 50,
  })

  return users
    .filter((user) => {
      const displayName = user.profile?.displayName || ""
      return (
        user.username.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        displayName.toLowerCase().includes(q)
      )
    })
    .slice(0, 10)
    .map(serializeUser)
}
