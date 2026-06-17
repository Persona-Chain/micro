import { proxyBountyBeeRequest } from "@/lib/server/bountybee-proxy"
import { readSats } from "@/lib/server/eggwallet-send"
import { getExternalAuthToken } from "@/lib/server/external-wallets"
import {
  findSubmission,
  loadSenderWallet,
  loadSubmissions,
  loadTask,
  makeJsonRequest,
  readTaskRewardSats,
  readWorkerAddress,
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

  const body = await req.json().catch(() => null)
  const submissionId = Number(body?.submissionId)
  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    return NextResponse.json({ success: false, message: "Missing submissionId." }, { status: 400 })
  }

  try {
    const [senderWallet, task, submissions] = await Promise.all([
      loadSenderWallet(token),
      loadTask(token, id),
      loadSubmissions(token, id),
    ])
    const submission = findSubmission(submissions, submissionId)
    if (!submission) {
      return NextResponse.json({ success: false, message: "Submission not found." }, { status: 404 })
    }

    const workerAddress = readWorkerAddress(submission)
    const payoutAmount = readSats(body?.amount) ?? readTaskRewardSats(task, submission)
    if (!payoutAmount) {
      return NextResponse.json(
        { success: false, message: "Unable to determine the task reward payout amount." },
        { status: 400 },
      )
    }

    const payout = await sendTaskBsv({
      token,
      fromAddress: senderWallet.address,
      to: workerAddress,
      amount: payoutAmount,
      label: "worker payout",
    })

    const approveResponse = await proxyBountyBeeRequest(
      makeJsonRequest(req.url, {
        ...body,
        amount: payoutAmount,
        payoutAmount,
        workerAddress,
        payoutTxid: payout.txid,
        txid: payout.txid,
      }),
      `/api/v1/tasks/${encodeURIComponent(id)}/approve`,
      { auth: true },
    )
    const approveData = await approveResponse.json().catch(() => null)

    return NextResponse.json(
      {
        ...(approveData && typeof approveData === "object" ? approveData : {}),
        success: approveResponse.ok && approveData?.success !== false,
        amount: payoutAmount,
        workerAddress,
        txid: payout.txid,
        payoutTxid: payout.txid,
        approveStatus: approveResponse.status,
        send: payout.response,
        usedFallbackWif: payout.usedFallbackWif,
      },
      { status: approveResponse.status },
    )
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to approve and pay worker.",
        availableBalance: error?.availableBalance,
      },
      { status: Number(error?.status) || 400 },
    )
  }
}
