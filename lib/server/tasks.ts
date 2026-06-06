import { prisma } from "@/lib/server/prisma"
import { createNotification } from "@/lib/server/dashboard"
import { slugify } from "@/lib/server/slug"
import { parseFutureDate, step1Schema, step2Schema, step3Schema, step4Schema } from "@/lib/server/tasks-validation"
import { PLATFORM_REVENUE_ADDRESS, TASK_CREATION_FEE_USD } from "@/lib/server/admin-analytics"
import { getBsvPriceUsd, usdToSats } from "@/lib/server/bsv-price"
import { creditPlatformFee } from "@/lib/server/platform-fees"
import { sendOnChainPayment } from "@/lib/server/wallet"

export async function createDraftTask(userId: number) {
  const task = await prisma.task.create({
    data: {
      userId,
      status: "draft",
      moderationStatus: "pending",
      currency: "BSV",
      visibility: "private",
      featuredTask: false,
      autoApprove: false,
    },
    select: { id: true },
  })

  await createNotification(userId, "task", `Task draft created. Continue setup to publish your task.`, `/dashboard`)
  return task
}

export async function getTaskForOwner(taskId: number, userId: number) {
  return prisma.task.findFirst({
    where: { id: taskId, userId },
    include: {
      category: true,
      tags: { include: { tag: true } },
      attachments: true,
    },
  })
}

export async function updateTaskStep(taskId: number, userId: number, step: number, payload: unknown) {
  const task = await prisma.task.findFirst({ where: { id: taskId, userId } })
  if (!task) throw new Error("Task not found")
  if (task.status !== "draft") throw new Error("Only draft tasks can be edited")

  if (step === 1) {
    const data = step1Schema.parse(payload)
    const category = await prisma.category.findUnique({ where: { id: data.categoryId }, select: { id: true, name: true } })
    if (!category) throw new Error("Invalid category")

    const baseSlug = slugify(data.title)
    let slug = baseSlug
    let suffix = 1
    while (slug) {
      const existing = await prisma.task.findFirst({ where: { slug, NOT: { id: taskId } }, select: { id: true } })
      if (!existing) break
      suffix += 1
      slug = `${baseSlug}-${suffix}`
    }

    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: {
          title: data.title,
          shortDescription: data.shortDescription,
          categoryId: data.categoryId,
          slug,
          step1Complete: true,
        },
      })

      // Upsert tags and relation rows.
      const tagNames = Array.from(new Set(data.tags.map((t) => t.toLowerCase())))
      await tx.taskTag.deleteMany({ where: { taskId } })
      for (const name of tagNames) {
        const tag = await tx.tag.upsert({
          where: { name },
          update: {},
          create: { name },
        })
        await tx.taskTag.create({ data: { taskId, tagId: tag.id } })
      }
    })

    await rebuildSearchText(taskId)
    return
  }

  if (step === 2) {
    const data = step2Schema.parse(payload)
    await prisma.task.update({
      where: { id: taskId },
      data: {
        fullDescription: data.fullDescription,
        requirements: data.requirements,
        instructions: data.instructions ?? "",
        step2Complete: true,
      },
    })
    await rebuildSearchText(taskId)
    return
  }

  if (step === 3) {
    const data = step3Schema.parse(payload)
    const balance = await prisma.internalBalance.findUnique({ where: { userId }, select: { availableBalance: true } })
    const available = balance?.availableBalance ?? 0
    const required = data.rewardAmount * data.maxWorkers
    if (available < required) {
      throw new Error("Insufficient balance to fund this task")
    }

    await prisma.task.update({
      where: { id: taskId },
      data: {
        rewardAmount: data.rewardAmount,
        currency: data.currency,
        maxWorkers: data.maxWorkers,
        estimatedCompletionTime: data.estimatedCompletionTime ?? null,
        step3Complete: true,
      },
    })
    return
  }

  if (step === 4) {
    const data = step4Schema.parse(payload)
    const expirationDate = parseFutureDate(data.expirationDate)
    await prisma.task.update({
      where: { id: taskId },
      data: {
        expirationDate,
        visibility: data.visibility,
        featuredTask: data.featuredTask,
        autoApprove: data.autoApprove,
        step4Complete: true,
      },
    })
    return
  }

  throw new Error("Invalid step")
}

export async function publishTask(taskId: number, userId: number) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    include: { tags: { include: { tag: true } }, category: true },
  })
  if (!task) throw new Error("Task not found")
  if (task.status !== "draft") throw new Error("Task is not a draft")

  if (!task.step1Complete || !task.step2Complete || !task.step3Complete || !task.step4Complete) {
    throw new Error("Complete all steps before publishing")
  }

  const required = task.rewardAmount * task.maxWorkers
  const balance = await prisma.internalBalance.findUnique({ where: { userId } })
  const available = balance?.availableBalance ?? 0
  
  const bsvPriceUsd = await getBsvPriceUsd()
  const taskFeeInSatoshis = usdToSats(TASK_CREATION_FEE_USD, bsvPriceUsd)
  
  const estimatedNetworkFee = 1000
  const totalRequired = required + taskFeeInSatoshis + estimatedNetworkFee
  if (available < totalRequired) throw new Error("Insufficient balance to publish (funding required + platform fee)")

  const feePayment = await sendOnChainPayment(userId, PLATFORM_REVENUE_ADDRESS, taskFeeInSatoshis)

  await prisma.$transaction(async (tx) => {
    // The platform fee was already sent on-chain. Reserve only the task reward.
    await tx.internalBalance.upsert({
      where: { userId },
      update: { 
        availableBalance: { decrement: required },
        reservedBalance: { increment: required } 
      },
      create: { userId, availableBalance: 0, pendingBalance: 0, reservedBalance: required },
    })

    // Record the payer-side fee and credit the platform admin account.
    await tx.transaction.create({
      data: {
        userId,
        txid: feePayment.txid,
        type: "task_creation_fee",
        amount: taskFeeInSatoshis,
        fee: feePayment.fee,
        confirmations: 0,
        address: PLATFORM_REVENUE_ADDRESS,
        status: "broadcast",
        taskId,
      },
    })
    await creditPlatformFee(tx, {
      amount: taskFeeInSatoshis,
      txid: `${feePayment.txid}_platform_credit`,
      taskId,
    })

    await tx.task.update({
      where: { id: taskId },
      data: {
        // Moderation temporarily auto-approved so tasks appear immediately.
        status: "published",
        moderationStatus: "approved",
        publishedAt: new Date(),
        lockedRewardTotal: required,
      },
    })

    await tx.taskModeration.create({
      data: {
        taskId,
        decision: "approved",
        reason: null,
        moderatorId: null,
      },
    })
  })

  await createNotification(userId, "task", `Your task "${task.title ?? "Untitled"}" is now published.`, `/task/${taskId}`)
}

export async function pauseTask(taskId: number, userId: number) {
  const task = await prisma.task.findFirst({ where: { id: taskId, userId } })
  if (!task) throw new Error("Task not found")
  if (task.status !== "published") throw new Error("Only published tasks can be paused")
  await prisma.task.update({ where: { id: taskId }, data: { status: "paused" } })
}

export async function duplicateTask(taskId: number, userId: number) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    include: { tags: true, attachments: true },
  })
  if (!task) throw new Error("Task not found")

  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.task.create({
      data: {
        userId,
        title: task.title,
        shortDescription: task.shortDescription,
        fullDescription: task.fullDescription,
        requirements: task.requirements,
        instructions: task.instructions,
        rewardAmount: task.rewardAmount,
        currency: task.currency,
        maxWorkers: task.maxWorkers,
        estimatedCompletionTime: task.estimatedCompletionTime,
        expirationDate: task.expirationDate,
        visibility: "private",
        featuredTask: false,
        autoApprove: task.autoApprove,
        status: "draft",
        moderationStatus: "pending",
        categoryId: task.categoryId,
        step1Complete: task.step1Complete,
        step2Complete: task.step2Complete,
        step3Complete: task.step3Complete,
        step4Complete: task.step4Complete,
      },
      select: { id: true },
    })

    for (const t of task.tags) {
      await tx.taskTag.create({ data: { taskId: draft.id, tagId: t.tagId } })
    }

    for (const a of task.attachments) {
      await tx.taskAttachment.create({
        data: {
          taskId: draft.id,
          fileName: a.fileName,
          filePath: a.filePath,
          fileSize: a.fileSize,
          mimeType: a.mimeType,
        },
      })
    }

    return draft
  })

  await rebuildSearchText(created.id)
  return created
}

export async function deleteTask(taskId: number, userId: number) {
  const task = await prisma.task.findFirst({ where: { id: taskId, userId } })
  if (!task) throw new Error("Task not found")
  await deleteTaskPermanently(taskId)
}

export async function deleteTaskPermanently(taskId: number) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, userId: true, lockedRewardTotal: true },
  })
  if (!task) throw new Error("Task not found")

  await prisma.$transaction(async (tx) => {
    if (task.lockedRewardTotal > 0) {
      await tx.internalBalance.update({
        where: { userId: task.userId },
        data: {
          reservedBalance: { decrement: task.lockedRewardTotal },
          availableBalance: { increment: task.lockedRewardTotal },
        },
      })
    }

    await tx.transaction.updateMany({
      where: { taskId },
      data: { taskId: null },
    })

    await tx.task.delete({ where: { id: taskId } })
  })
}

async function rebuildSearchText(taskId: number) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { category: true, tags: { include: { tag: true } } },
  })
  if (!task) return
  const parts = [
    task.title || "",
    task.shortDescription || "",
    task.fullDescription || "",
    task.category?.name || "",
    ...task.tags.map((t) => t.tag.name),
  ]
  const searchText = parts.join(" ").replace(/\s+/g, " ").trim()
  await prisma.task.update({ where: { id: taskId }, data: { searchText } })
}
