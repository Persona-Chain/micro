import { proxyBountyBeeRequest } from "@/lib/server/bountybee-proxy"
import { getExternalAuthToken } from "@/lib/server/external-wallets"
import {
  assertConfirmedBalance,
  getPlatformFeeAddress,
  getPublishFeeSats,
  loadSenderWallet,
  loadTask,
  makeJsonRequest,
  readSatsFromFields,
  sendTaskBsv,
} from "@/lib/server/task-payments"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const token = await getExternalAuthToken()
  if (!token) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const originalBody = await req.json().catch(() => ({}))
  const feeAddress = getPlatformFeeAddress()
  if (!feeAddress) {
    return NextResponse.json(
      {
        success: false,
        message: "Missing admin fee address. Set ADMIN_BSV_ADDRESS or PLATFORM_FEE_ADDRESS.",
      },
      { status: 500 },
    )
  }

  let task: any = null
  let fromAddress = ""
  try {
    const [senderWallet, taskData, feeAmount] = await Promise.all([
      loadSenderWallet(token),
      loadTask(token, id),
      getPublishFeeSats(),
    ])
    task = taskData
    fromAddress = senderWallet.address

    const rewardAmount = readSatsFromFields(task, ["rewardAmount", "lockedRewardTotal", "reward"]) ?? 0
    await assertConfirmedBalance(fromAddress, rewardAmount + feeAmount, "task reward and publish fee")

    const feeSend = await sendTaskBsv({
      token,
      fromAddress,
      to: feeAddress,
      amount: feeAmount,
      label: "platform fee",
    })

    return proxyBountyBeeRequest(
      makeJsonRequest(req.url, {
        ...originalBody,
        platformFeeAddress: feeAddress,
        platformFeeAmount: feeAmount,
        platformFeeTxid: feeSend.txid,
        feeAddress,
        feeAmount,
        feeTxid: feeSend.txid,
      }),
      `/api/v1/tasks/${encodeURIComponent(id)}/publish`,
      { auth: true },
    )
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to send task publish fee.",
        availableBalance: error?.availableBalance,
        taskId: task?.id ?? id,
        fromAddress: fromAddress || undefined,
      },
      { status: Number(error?.status) || 400 },
    )
  }
}
