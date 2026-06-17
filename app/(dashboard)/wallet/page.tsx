"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  QrCode,
  RefreshCw,
  Bitcoin,
  Zap,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatSatoshis, timeAgo } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { copyText } from "@/lib/client/clipboard"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

function isLikelyBsvAddress(value: string) {
  return /^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(value.trim())
}

type WalletBalancePayload = {
  availableBalance?: number | string | null
  pendingBalance?: number | string | null
  reservedBalance?: number | string | null
  confirmedBalance?: number | string | null
  unconfirmedBalance?: number | string | null
  totalBalance?: number | string | null
  balanceSats?: number | string | null
  sats?: number | string | null
  balance?: WalletBalancePayload | number | string | null
  balances?: WalletBalancePayload | null
  data?: WalletBalancePayload | null
  wallet?: WalletBalancePayload | null
}

type WalletTransaction = {
  txid: string
  type: string
  amount: number
  fee?: number | null
  confirmations: number
  status: string
  address: string
  createdAt: string
}

type WalletHistoryPayload = {
  transactions?: unknown
  recentTransactions?: unknown
  history?: unknown
  items?: unknown
  data?: unknown
  result?: unknown
  wallet?: unknown
}

function toSats(value: unknown) {
  const sats = Number(value || 0)
  return Number.isFinite(sats) ? sats : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object")
}

function isWalletBalancePayload(value: unknown): value is WalletBalancePayload {
  return Boolean(value && typeof value === "object")
}

function unwrapWalletBalancePayload(data: WalletBalancePayload | null): WalletBalancePayload {
  if (!data) return {}
  if (isWalletBalancePayload(data.data)) return unwrapWalletBalancePayload(data.data)
  if (isWalletBalancePayload(data.wallet)) return unwrapWalletBalancePayload(data.wallet)
  if (isWalletBalancePayload(data.balances)) return unwrapWalletBalancePayload(data.balances)
  if (isWalletBalancePayload(data.balance)) return unwrapWalletBalancePayload(data.balance)
  return data
}

function readWalletBalances(data: WalletBalancePayload | null) {
  const source = unwrapWalletBalancePayload(data)
  const confirmed =
    source.availableBalance ??
    source.confirmedBalance ??
    source.balanceSats ??
    source.sats ??
    (typeof source.balance === "number" || typeof source.balance === "string" ? source.balance : undefined)
  const pending = source.pendingBalance ?? source.unconfirmedBalance
  return {
    confirmed: confirmed !== undefined ? toSats(confirmed) : toSats(source.totalBalance),
    pending: toSats(pending),
  }
}

function hasWalletBalanceFields(data: WalletBalancePayload | null) {
  const source = unwrapWalletBalancePayload(data)
  if (!source) return false
  return (
    source.availableBalance !== undefined ||
    source.pendingBalance !== undefined ||
    source.reservedBalance !== undefined ||
    source.confirmedBalance !== undefined ||
    source.unconfirmedBalance !== undefined ||
    source.totalBalance !== undefined ||
    source.balanceSats !== undefined ||
    source.sats !== undefined ||
    typeof source.balance === "number" ||
    typeof source.balance === "string"
  )
}

function unwrapWalletHistoryPayload(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (!isRecord(data)) return []

  const payload = data as WalletHistoryPayload
  const candidates = [
    payload.transactions,
    payload.recentTransactions,
    payload.history,
    payload.items,
    payload.data,
    payload.result,
    payload.wallet,
  ]

  for (const candidate of candidates) {
    const transactions = unwrapWalletHistoryPayload(candidate)
    if (transactions.length) return transactions
  }

  return []
}

function normalizeTransactionType(value: unknown) {
  const type = String(value || "").toLowerCase()
  if (["received", "receive", "incoming", "in"].includes(type)) return "deposit"
  if (["sent", "send", "outgoing", "out"].includes(type)) return "withdrawal"
  return type || "transaction"
}

function normalizeWalletTransaction(value: unknown, index: number): WalletTransaction | null {
  if (!isRecord(value)) return null

  const nested = isRecord(value.transaction) ? value.transaction : {}
  const source = { ...value, ...nested }
  const amount = Math.abs(toSats(source.amount ?? source.amountSats ?? source.satoshis ?? source.value ?? source.valueSats))
  if (amount <= 0) return null

  const txid = String(source.txid ?? source.txId ?? source.hash ?? source.id ?? `transaction-${index}`)
  const address = String(
    source.address ??
      source.toAddress ??
      source.fromAddress ??
      source.destinationAddress ??
      source.senderAddress ??
      source.receiverAddress ??
      "",
  )

  return {
    txid,
    type: normalizeTransactionType(source.type ?? source.direction ?? source.kind),
    amount,
    fee: source.fee === undefined || source.fee === null ? null : toSats(source.fee),
    confirmations: toSats(source.confirmations),
    status: String(source.status || "completed").toLowerCase(),
    address,
    createdAt: String(source.createdAt ?? source.created_at ?? source.timestamp ?? source.time ?? new Date().toISOString()),
  }
}

function readWalletTransactions(data: unknown) {
  return unwrapWalletHistoryPayload(data)
    .map((tx, index) => normalizeWalletTransaction(tx, index))
    .filter((tx): tx is WalletTransaction => Boolean(tx))
}

export default function WalletPage() {
  const [activeTab, setActiveTab] = useState("overview")
  const [depositAmount, setDepositAmount] = useState(100000)
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [withdrawAddress, setWithdrawAddress] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [copied, setCopied] = useState(false)
  const [depositAddressCopied, setDepositAddressCopied] = useState(false)
  const [depositAddress, setDepositAddress] = useState<string>("")
  const [isLoadingDepositAddress, setIsLoadingDepositAddress] = useState(false)
  const [depositAddressError, setDepositAddressError] = useState("")
  const [confirmedBalance, setConfirmedBalance] = useState(0)
  const [pendingBalance, setPendingBalance] = useState(0)
  const [bsvPriceUsd, setBsvPriceUsd] = useState<number | null>(null)
  const [isLoadingBalances, setIsLoadingBalances] = useState(false)
  const [withdrawError, setWithdrawError] = useState("")
  const [withdrawSuccess, setWithdrawSuccess] = useState("")
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])

  const totalBalance = confirmedBalance + pendingBalance

  function satsToUsdString(sats: number) {
    if (!bsvPriceUsd) return "—"
    const usd = (sats / 100_000_000) * bsvPriceUsd
    if (!Number.isFinite(usd)) return "—"
    return `$${usd.toFixed(2)}`
  }

  async function copyDepositAddress() {
    if (await copyText(depositAddress || "")) {
      setDepositAddressCopied(true)
      setTimeout(() => setDepositAddressCopied(false), 2000)
    }
  }

  async function handleDeposit() {
    if (!depositAddress) {
      setDepositAddressError("Unable to load your deposit address.")
      return
    }

    if (!depositAmount || depositAmount <= 0) {
      setDepositAddressError("Enter a valid deposit amount.")
      return
    }

    setDepositAddressError("")
    setIsProcessing(true)
    await new Promise((resolve) => setTimeout(resolve, 500))
    setIsProcessing(false)
    setShowQr(true)
  }

  async function handleWithdraw() {
    setWithdrawError("")
    setWithdrawSuccess("")

    const amount = Number(withdrawAmount)
    const destinationAddress = withdrawAddress.trim()
    if (!destinationAddress) {
      setWithdrawError("Enter a destination BSV address.")
      return
    }

    if (!isLikelyBsvAddress(destinationAddress)) {
      setWithdrawError("Enter a valid on-chain BSV address that starts with 1.")
      return
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      setWithdrawError("Enter a valid amount in sats.")
      return
    }

    setIsProcessing(true)
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: destinationAddress, amount }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.message || "Withdrawal failed.")
      }
      const txid = data?.txid || data?.transaction?.txid || data?.withdrawal?.txid
      setWithdrawSuccess(
        txid
          ? `Withdrawal broadcast. Transaction ID: ${txid}`
          : "Withdrawal accepted. Waiting for broadcast confirmation.",
      )
      setWithdrawAddress("")
      setWithdrawAmount("")
      setIsLoadingBalances(true)
      await syncAndLoadBalance()
      await loadWalletHistory()
    } catch (e) {
      setWithdrawError(e instanceof Error ? e.message : "Withdrawal failed.")
    } finally {
      setIsLoadingBalances(false)
      setIsProcessing(false)
    }
  }

  async function loadDepositAddress() {
    setIsLoadingDepositAddress(true)
    setDepositAddressError("")

    try {
      const res = await fetch("/api/wallet/deposit-address", { method: "GET" })
      if (res.ok) {
        const data = await res.json().catch(() => null)
        setDepositAddress(String(data?.address || ""))
        return
      }

      await fetch("/api/wallet/create", { method: "POST" })
      const retry = await fetch("/api/wallet/deposit-address", { method: "GET" })
      const data = await retry.json().catch(() => null)
      if (!retry.ok) throw new Error(data?.message || "Failed to load deposit address")
      setDepositAddress(String(data?.address || ""))
    } catch (e) {
      setDepositAddressError(e instanceof Error ? e.message : "Failed to load deposit address")
    } finally {
      setIsLoadingDepositAddress(false)
    }
  }

  async function copyAddress() {
    const value = showQr && depositAddress ? `${depositAddress}?amount=${(depositAmount / 100_000_000).toFixed(8)}` : depositAddress
    if (await copyText(value || "")) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function applyWalletBalances(data: WalletBalancePayload | null) {
    const balances = readWalletBalances(data)
    setConfirmedBalance(balances.confirmed)
    setPendingBalance(balances.pending)
  }

  async function syncAndLoadBalance() {
    const syncRes = await fetch("/api/wallet/sync", { method: "POST" })
    const syncData = syncRes.ok ? ((await syncRes.json().catch(() => null)) as WalletBalancePayload | null) : null

    const balanceRes = await fetch("/api/wallet/balance", { cache: "no-store" })
    const balanceData = balanceRes.ok ? ((await balanceRes.json().catch(() => null)) as WalletBalancePayload | null) : null

    applyWalletBalances(hasWalletBalanceFields(balanceData) ? balanceData : syncData)
  }

  async function loadWalletHistory() {
    const historyRes = await fetch("/api/wallet/history", { cache: "no-store" })
    if (!historyRes.ok) return

    const historyData = await historyRes.json().catch(() => null)
    setTransactions(readWalletTransactions(historyData))
  }

  useEffect(() => {
    loadDepositAddress()

    ;(async () => {
      setIsLoadingBalances(true)
      try {
        const [priceRes, historyRes] = await Promise.all([
          fetch("/api/market/bsv-price", { method: "GET" }),
          fetch("/api/wallet/history", { cache: "no-store" }),
        ])

        if (priceRes.ok) {
          const priceData = await priceRes.json().catch(() => null)
          const usd = Number(priceData?.usd)
          if (Number.isFinite(usd) && usd > 0) setBsvPriceUsd(usd)
        }

        await syncAndLoadBalance()

        if (historyRes.ok) {
          const historyData = await historyRes.json().catch(() => null)
          setTransactions(readWalletTransactions(historyData))
        }
      } finally {
        setIsLoadingBalances(false)
      }
    })()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants}>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Wallet</h1>
          <p className="text-muted-foreground mt-1">Manage your Bitcoin balances</p>
        </motion.div>

        {/* Balance Cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="relative overflow-hidden border-bitcoin-500/20">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Bitcoin className="h-24 w-24 text-bitcoin-500" />
            </div>
            <CardHeader className="pb-2">
              <CardDescription>Total Balance</CardDescription>
              <CardTitle className="text-3xl font-mono">{formatSatoshis(totalBalance)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{isLoadingBalances ? "Loading…" : satsToUsdString(totalBalance)}</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Zap className="h-24 w-24 text-bitcoin-500" />
            </div>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                Confirmed
              </CardDescription>
              <CardTitle className="text-2xl font-mono">{formatSatoshis(confirmedBalance)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{isLoadingBalances ? "Loading…" : satsToUsdString(confirmedBalance)}</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Bitcoin className="h-24 w-24 text-muted-foreground" />
            </div>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-amber-500" />
                Pending
              </CardDescription>
              <CardTitle className="text-2xl font-mono">{formatSatoshis(pendingBalance)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{isLoadingBalances ? "Loading…" : satsToUsdString(pendingBalance)}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Content */}
        <motion.div variants={itemVariants}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="deposit">Deposit</TabsTrigger>
              <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Deposit or withdraw Bitcoin</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      className="w-full bg-bitcoin-500 hover:bg-bitcoin-600 text-white"
                      onClick={() => setActiveTab("deposit")}
                    >
                      <ArrowDownLeft className="mr-2 h-4 w-4" />
                      Deposit Bitcoin-SV
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setActiveTab("withdraw")}
                    >
                      <ArrowUpRight className="mr-2 h-4 w-4" />
                      Withdraw Bitcoin-SV
                    </Button>
                  </CardContent>
                </Card>

                {/* BSV Deposit Address */}
                <Card>
                  <CardHeader>
                    <CardTitle>BSV Deposit Address</CardTitle>
                    <CardDescription>Receive on-chain BSV payments</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                      <Zap className="h-4 w-4 text-bitcoin-500 shrink-0" />
                      <code className="text-sm font-mono flex-1 truncate">
                        {isLoadingDepositAddress ? "Loadingâ€¦" : depositAddress || "â€”"}
                      </code>
                      <Button variant="ghost" size="icon-sm" onClick={copyDepositAddress} disabled={!depositAddress}>
                        {depositAddressCopied ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Share this BSV address to receive on-chain payments directly to your wallet.
                    </p>
                  </CardContent>
                </Card>

              </div>

              {/* Recent Activity */}
              <Card>
                <CardHeader className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                  <div>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Your latest transactions</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab("history")}>
                    View All
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {transactions.slice(0, 5).map((tx) => (
                      <div
                        key={tx.txid}
                        className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border/40 hover:bg-accent/50 transition-colors sm:flex-nowrap sm:gap-4"
                      >
                        <div
                          className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                            tx.type === "deposit" || tx.type === "earning"
                              ? "bg-emerald-500/10"
                              : tx.type === "withdrawal"
                              ? "bg-destructive/10"
                              : "bg-bitcoin-500/10"
                          )}
                        >
                          {tx.type === "deposit" || tx.type === "earning" ? (
                            <TrendingUp className="h-5 w-5 text-emerald-500" />
                          ) : tx.type === "withdrawal" ? (
                            <TrendingDown className="h-5 w-5 text-destructive" />
                          ) : (
                            <Wallet className="h-5 w-5 text-bitcoin-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {tx.address ? tx.address : tx.type}
                          </p>
                          <p className="text-xs text-muted-foreground">{timeAgo(tx.createdAt)}</p>
                        </div>
                        <div className="ml-auto text-right">
                          <p
                            className={cn(
                              "text-sm font-mono font-medium",
                              tx.type === "deposit" || tx.type === "earning"
                                ? "text-emerald-500"
                                : tx.type === "withdrawal"
                                ? "text-destructive"
                                : "text-bitcoin-500"
                            )}
                          >
                            {tx.type === "deposit" || tx.type === "earning" ? "+" : "-"}
                            {formatSatoshis(tx.amount)}
                          </p>
                          <Badge
                            variant={tx.status === "completed" ? "success" : "warning"}
                            className="text-[10px]"
                          >
                            {tx.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="deposit" className="space-y-6">
              <div className="max-w-lg mx-auto">
                <Card>
                  <CardHeader>
                    <CardTitle>Deposit Bitcoin-SV (On-chain)</CardTitle>
                    <CardDescription>Send BSV to your personal deposit address</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {depositAddressError && (
                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
                        {depositAddressError}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Deposit Address</Label>
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                        <code className="text-sm font-mono flex-1 truncate">
                          {isLoadingDepositAddress ? "Loading…" : depositAddress || "—"}
                        </code>
                        <Button variant="ghost" size="icon-sm" onClick={copyAddress} disabled={!depositAddress}>
                          {copied ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Send BSV to this address. Your balance updates after confirmations.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button variant="outline" onClick={loadDepositAddress} disabled={isLoadingDepositAddress}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh Address
                      </Button>
                      <Button
                        className="bg-bitcoin-500 hover:bg-bitcoin-600 text-white"
                        onClick={async () => {
                          setIsProcessing(true)
                          try {
                            await syncAndLoadBalance()
                          } finally {
                            setIsProcessing(false)
                          }
                        }}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Sync Deposits
                          </>
                        )}
                      </Button>
                    </div>
                    {/* On-chain deposit address shown below */}
                    {!showQr ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="deposit-amount">Amount (sats)</Label>
                          <div className="relative">
                            <Bitcoin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-bitcoin-500" />
                            <Input
                              id="deposit-amount"
                              type="number"
                              className="pl-10"
                              value={depositAmount}
                              onChange={(e) => setDepositAmount(parseInt(e.target.value))}
                              min={1000}
                              step={1000}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {bsvPriceUsd ? satsToUsdString(depositAmount) : "USD conversion unavailable"}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          {[50000, 100000, 500000, 1000000].map((amount) => (
                            <Button
                              key={amount}
                              variant={depositAmount === amount ? "secondary" : "outline"}
                              size="sm"
                              onClick={() => setDepositAmount(amount)}
                              className="flex-1"
                            >
                              {formatSatoshis(amount)}
                            </Button>
                          ))}
                        </div>

                        <Button
                          className="w-full bg-bitcoin-500 hover:bg-bitcoin-600 text-white"
                          onClick={handleDeposit}
                          disabled={isProcessing || !depositAddress}
                        >
                          {isProcessing ? (
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <QrCode className="mr-2 h-4 w-4" />
                              Create Deposit QR
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center space-y-4"
                      >
                        <div className="inline-block p-4 rounded-xl bg-white">
                          <div className="h-48 w-48 bg-gradient-to-br from-bitcoin-500 to-bitcoin-600 rounded-lg flex items-center justify-center">
                            <QrCode className="h-32 w-32 text-white" />
                          </div>
                        </div>
                        <div>
                          <p className="font-medium">On-chain Deposit URI</p>
                          <p className="text-sm text-muted-foreground">
                            Use your wallet to pay {formatSatoshis(depositAmount)} to your BSV address.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                          <code className="text-xs font-mono flex-1 truncate">
                            {`${depositAddress}?amount=${(depositAmount / 100_000_000).toFixed(8)}`}
                          </code>
                          <Button variant="ghost" size="icon-sm" onClick={copyAddress}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setShowQr(false)}>
                          Create New QR
                        </Button>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="withdraw" className="space-y-6">
              <div className="max-w-lg mx-auto">
                <Card>
                  <CardHeader>
                    <CardTitle>Withdraw Bitcoin-SV</CardTitle>
                    <CardDescription>Send BSV to an external on-chain wallet</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {withdrawError ? (
                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                        {withdrawError}
                      </div>
                    ) : null}
                    {withdrawSuccess ? (
                      <div className="p-3 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-800 text-sm">
                        {withdrawSuccess}
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <Label htmlFor="withdraw-address">Destination BSV Address</Label>
                      <Input
                        id="withdraw-address"
                        placeholder="1A1zP1..."
                        value={withdrawAddress}
                        onChange={(e) => setWithdrawAddress(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Use a legacy on-chain BSV address. Paymail, CashAddr, BTC SegWit, and Hatch addresses are not accepted.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="withdraw-amount">Amount (sats)</Label>
                      <div className="relative">
                        <Bitcoin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-bitcoin-500" />
                        <Input
                          id="withdraw-amount"
                          type="number"
                          className="pl-10"
                          placeholder="0"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          min={1000}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Available: {formatSatoshis(confirmedBalance)}</span>
                        <button
                          type="button"
                          className="text-bitcoin-500 hover:underline"
                          onClick={() => setWithdrawAmount(confirmedBalance.toString())}
                        >
                          Max
                        </button>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Network Fee</p>
                          <p className="text-xs text-muted-foreground">
                            A small BSV network fee may apply. Withdrawals are processed by the wallet backend.
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button
                      className="w-full bg-bitcoin-500 hover:bg-bitcoin-600 text-white"
                      onClick={handleWithdraw}
                      disabled={
                        isProcessing ||
                        !withdrawAmount ||
                        !isLikelyBsvAddress(withdrawAddress)
                      }
                    >
                      {isProcessing ? (
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <ArrowUpRight className="mr-2 h-4 w-4" />
                          Withdraw
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Transaction History</CardTitle>
                  <CardDescription>All your Bitcoin transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {transactions.map((tx) => (
                      <div
                        key={tx.txid}
                        className="flex flex-wrap items-center gap-3 p-4 rounded-lg border border-border/40 hover:bg-accent/50 transition-colors sm:flex-nowrap sm:gap-4"
                      >
                        <div
                          className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                            tx.type === "deposit" || tx.type === "earning"
                              ? "bg-emerald-500/10"
                              : tx.type === "withdrawal"
                              ? "bg-destructive/10"
                              : "bg-bitcoin-500/10"
                          )}
                        >
                          {tx.type === "deposit" || tx.type === "earning" ? (
                            <ArrowDownLeft className="h-5 w-5 text-emerald-500" />
                          ) : tx.type === "withdrawal" ? (
                            <ArrowUpRight className="h-5 w-5 text-destructive" />
                          ) : (
                            <Wallet className="h-5 w-5 text-bitcoin-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <p className="min-w-0 truncate text-sm font-medium">{tx.address || tx.type}</p>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {tx.type}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {timeAgo(tx.createdAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" />
                              {tx.txid.slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                        <div className="ml-auto text-right">
                          <p
                            className={cn(
                              "text-sm font-mono font-medium",
                              tx.type === "deposit" || tx.type === "earning"
                                ? "text-emerald-500"
                                : tx.type === "withdrawal"
                                ? "text-destructive"
                                : "text-bitcoin-500"
                            )}
                          >
                            {tx.type === "deposit" || tx.type === "earning" ? "+" : "-"}
                            {formatSatoshis(tx.amount)}
                          </p>
                          <Badge
                            variant={tx.status === "completed" ? "success" : tx.status === "pending" ? "warning" : "destructive"}
                            className="text-[10px]"
                          >
                            {tx.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </div>
  )
}
