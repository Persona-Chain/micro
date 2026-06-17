import { BountyBeeApiError, bountyBeeApiFetch } from "@/lib/server/bountybee-api"
import { getExternalBsvWallet } from "@/lib/server/external-wallets"
import { isBsvAddress, sendBsvWithEggwallet } from "@/lib/server/eggwallet-send"
import { getConfirmedBalance } from "@/lib/server/whatsonchain"

export function makeJsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

export function readSatsFromFields(source: any, fields: string[]) {
  for (const field of fields) {
    const amount = Number(source?.[field])
    if (Number.isInteger(amount) && amount > 0) return amount
  }
  return null
}

export function getPlatformFeeAddress() {
  return (
    process.env.ADMIN_BSV_ADDRESS ||
    process.env.PLATFORM_FEE_ADDRESS ||
    process.env.PLATFORM_REVENUE_ADDRESS ||
    process.env.REVENUE_ADDRESS ||
    ""
  ).trim()
}

export async function getPublishFeeSats() {
  const configured = Number(process.env.TASK_PUBLISH_FEE_SATS || process.env.PLATFORM_FEE_SATS)
  if (Number.isInteger(configured) && configured > 0) return configured

  try {
    const data = await bountyBeeApiFetch<any>("/api/v1/market/bsv-price")
    const priceUsd = Number(data?.priceUsd ?? data?.usd)
    if (Number.isFinite(priceUsd) && priceUsd > 0) {
      return Math.ceil((0.01 / priceUsd) * 100_000_000)
    }
  } catch {
    // Keep publishing usable if the price endpoint is temporarily down.
  }

  return 25000
}

export async function loadSenderWallet(token: string) {
  try {
    const wallet = await getExternalBsvWallet(token)
    const address = wallet?.address || null
    if (!address) {
      throw Object.assign(new Error("No BSV wallet address was found for this account. Log out and log in again to initialize it."), {
        status: 404,
      })
    }
    return { address }
  } catch (error) {
    if (error instanceof BountyBeeApiError && error.status === 401) {
      throw Object.assign(new Error("Your external wallet session expired. Log in again before sending BSV."), {
        status: 401,
      })
    }
    throw error
  }
}

export async function assertConfirmedBalance(address: string, amount: number, label: string) {
  let availableBalance: number | null = null
  try {
    availableBalance = (await getConfirmedBalance(address)).confirmed
  } catch {
    availableBalance = null
  }

  if (availableBalance !== null && amount > availableBalance) {
    throw Object.assign(new Error(`Insufficient confirmed on-chain balance for ${label}.`), {
      status: 402,
      availableBalance,
    })
  }

  return availableBalance
}

export async function sendTaskBsv(input: {
  token: string
  fromAddress: string
  to: string
  amount: number
  label: string
}) {
  if (!isBsvAddress(input.to)) {
    throw Object.assign(new Error(`Missing or invalid ${input.label} BSV address.`), { status: 400 })
  }

  await assertConfirmedBalance(input.fromAddress, input.amount, input.label)
  return sendBsvWithEggwallet({
    token: input.token,
    fromAddress: input.fromAddress,
    to: input.to.trim(),
    amount: input.amount,
  })
}

export async function loadTask(token: string, taskId: string) {
  const data = await bountyBeeApiFetch<any>(`/api/v1/tasks/${encodeURIComponent(taskId)}`, { token })
  return data?.task || data
}

export async function loadSubmissions(token: string, taskId: string) {
  const data = await bountyBeeApiFetch<any>(`/api/v1/tasks/${encodeURIComponent(taskId)}/submissions`, { token })
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.submissions)) return data.submissions
  if (Array.isArray(data?.data)) return data.data
  return []
}

export function findSubmission(submissions: any[], submissionId: number) {
  return submissions.find((submission) => Number(submission?.id) === submissionId) || null
}

export function readWorkerAddress(submission: any) {
  const candidates = [
    submission?.payoutAddress,
    submission?.workerAddress,
    submission?.walletAddress,
    submission?.address,
    submission?.user?.walletAddress,
    submission?.user?.wallet?.address,
    submission?.worker?.walletAddress,
    submission?.worker?.wallet?.address,
    submission?.applicant?.walletAddress,
    submission?.applicant?.wallet?.address,
  ]

  return String(candidates.find((value) => typeof value === "string" && value.trim()) || "").trim()
}

export function readTaskRewardSats(task: any, submission: any) {
  return readSatsFromFields(submission, ["rewardAmount", "amount", "payoutAmount", "netAmount"]) ??
    readSatsFromFields(task, ["rewardAmount", "lockedRewardTotal", "reward"])
}
