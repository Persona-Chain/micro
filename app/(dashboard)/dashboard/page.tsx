"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import type { Route } from "next"
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Zap,
  Bitcoin,
  Bell,
  BarChart3,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatBsv, formatBsvFromSats, timeAgo } from "@/lib/utils"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

type DashboardTransaction = {
  txid: string
  type: string
  amount: number
  status: string
  description: string
  createdAt: string
}

type DashboardNotification = {
  id: number
  type: string
  message: string
  link?: string | null
  read: boolean
  createdAt: string
}

type DashboardTask = {
  id: number
  title: string
  status: string
  reward: number
}

type DashboardOverview = {
  wallet: {
    availableBalance: number
    pendingBalance: number
    lockedBalance: number
  }
  earnings: { chart: Array<{ date: string; earnings: number }> }
  tasks: {
    activeTasks: number
    completedTasks: number
    pendingTasks: number
    draftTasks: number
  }
  transactions: DashboardTransaction[]
  notifications: DashboardNotification[]
  reputation: {
    score: number
    averageRating: number
    totalReviews: number
    completedTasks: number
  }
  activeTasks: DashboardTask[]
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadOverview() {
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" })
        if (!res.ok) throw new Error("Failed to load dashboard")
        const data = await res.json()
        setOverview(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }

    loadOverview()
  }, [])

  const unreadNotifications = useMemo(
    () => overview?.notifications.filter((n) => !n.read).slice(0, 5) ?? [],
    [overview],
  )

  const activeTasks = overview?.activeTasks ?? []
  const recentTransactions = overview?.transactions ?? []
  const totalBalance = overview
    ? overview.wallet.availableBalance + overview.wallet.pendingBalance + overview.wallet.lockedBalance
    : 0

  const getNotificationTitle = (type: string) => {
    switch (type) {
      case "payment":
        return "Payment update"
      case "task":
        return "Task update"
      case "escrow":
        return "Escrow update"
      default:
        return "Notification"
    }
  }

  if (error) {
    return (
      <div className="p-6 text-center text-destructive">
        <p className="text-lg font-semibold">Unable to load dashboard</p>
        <p className="mt-2 text-sm">{error}</p>
      </div>
    )
  }

  if (!overview) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p className="text-lg font-semibold">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Welcome back to your dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/create-task">
              <Button variant="outline" size="sm">
                <Zap className="mr-2 h-4 w-4" />
                Post Task
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button size="sm" className="bg-bitcoin-500 hover:bg-bitcoin-600 text-white">
                <Bitcoin className="mr-2 h-4 w-4" />
                Find Work
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Wallet className="h-16 w-16 text-bitcoin-500" />
            </div>
            <CardHeader className="pb-2">
              <CardDescription>Total Balance</CardDescription>
              <CardTitle className="text-2xl font-mono">{formatBsv(totalBalance)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Available + pending + locked</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp className="h-16 w-16 text-emerald-500" />
            </div>
            <CardHeader className="pb-2">
              <CardDescription>This Week</CardDescription>
              <CardTitle className="text-2xl font-mono text-emerald-500">
                +{formatBsv(overview?.earnings.chart.reduce((a, b) => a + b.earnings, 0) ?? 0)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1 text-xs text-emerald-500">
                <TrendingUp className="h-3 w-3" />
                <span>+23% from last week</span>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <CheckCircle2 className="h-16 w-16 text-blue-500" />
            </div>
            <CardHeader className="pb-2">
              <CardDescription>Completed Tasks</CardDescription>
              <CardTitle className="text-2xl">{overview?.tasks.completedTasks ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Lifetime completions</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <BarChart3 className="h-16 w-16 text-bitcoin-500" />
            </div>
            <CardHeader className="pb-2">
              <CardDescription>Reputation</CardDescription>
              <CardTitle className="text-2xl">{overview?.reputation.score.toFixed(1) ?? "0.0"}/5.0</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={(overview?.reputation.score ?? 0) * 20} className="h-1.5" />
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Earnings Chart */}
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Earnings Overview</CardTitle>
                  <CardDescription>Your earnings over the past 7 days</CardDescription>
                </div>
                <Badge variant="bitcoin">This Week</Badge>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={overview?.earnings.chart ?? []}>
                      <defs>
                        <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F7931A" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#F7931A" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        tickFormatter={(value) => `${Number(value).toFixed(4)} BSV`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [formatBsv(value), "Earnings"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="earnings"
                        stroke="#F7931A"
                        strokeWidth={2}
                        fill="url(#earningsGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Notifications Panel */}
          <motion.div variants={itemVariants}>
            <Card className="h-full">
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2 sm:items-center">
                <div>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>Recent activity</CardDescription>
                </div>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-3">
                    {unreadNotifications.length > 0 ? (
                      unreadNotifications.map((notif) => (
                        <div
                          key={notif.id}
                          className="flex items-start gap-3 p-3 rounded-lg bg-accent/50 border border-border/40"
                        >
                          <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${
                            notif.type === 'payment' ? 'bg-emerald-500' :
                            notif.type === 'task' ? 'bg-blue-500' :
                            notif.type === 'message' ? 'bg-bitcoin-500' :
                            'bg-muted-foreground'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{getNotificationTitle(notif.type)}</p>
                            <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">{timeAgo(notif.createdAt)}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No new notifications</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Tasks */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="flex flex-col gap-2 pb-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                <div>
                  <CardTitle>Active Tasks</CardTitle>
                  <CardDescription>Tasks you're currently working on</CardDescription>
                </div>
                <Link href="/marketplace">
                  <Button variant="ghost" size="sm" className="text-bitcoin-500">
                    View all
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeTasks.length > 0 ? (
                    activeTasks.map((task) => (
                      <Link key={task.id} href={`/task/${task.id}` as Route}>
                        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border/40 hover:bg-accent/50 transition-colors group sm:flex-nowrap sm:gap-4">
                          <div className="h-10 w-10 rounded-lg bg-bitcoin-500/10 flex items-center justify-center shrink-0">
                            <Clock className="h-5 w-5 text-bitcoin-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-bitcoin-500 transition-colors">
                              {task.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Status: {task.status.replace(/_/g, " ")}
                            </p>
                          </div>
                          <Badge variant="bitcoin" className="ml-auto shrink-0">{formatBsvFromSats(task.reward)}</Badge>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No active tasks</p>
                      <Link href="/marketplace">
                        <Button variant="link" size="sm" className="text-bitcoin-500 mt-2">
                          Browse marketplace
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Transactions */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="flex flex-col gap-2 pb-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                <div>
                  <CardTitle>Recent Transactions</CardTitle>
                  <CardDescription>Your latest Bitcoin movements</CardDescription>
                </div>
                <Link href="/wallet">
                  <Button variant="ghost" size="sm" className="text-bitcoin-500">
                    View all
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentTransactions.map((tx) => (
                    <div
                      key={tx.txid}
                      className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border/40 sm:flex-nowrap sm:gap-4"
                    >
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                        tx.type === 'deposit' || tx.type === 'payout'
                          ? 'bg-emerald-500/10'
                          : tx.type === 'withdrawal'
                          ? 'bg-destructive/10'
                          : 'bg-bitcoin-500/10'
                      }`}>
                        {tx.type === 'deposit' || tx.type === 'payout' ? (
                          <TrendingUp className="h-5 w-5 text-emerald-500" />
                        ) : tx.type === 'withdrawal' ? (
                          <TrendingDown className="h-5 w-5 text-destructive" />
                        ) : (
                          <Wallet className="h-5 w-5 text-bitcoin-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">{timeAgo(tx.createdAt)}</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className={`text-sm font-mono font-medium ${
                          tx.type === 'deposit' || tx.type === 'payout'
                            ? 'text-emerald-500'
                            : tx.type === 'withdrawal'
                            ? 'text-destructive'
                            : 'text-bitcoin-500'
                        }`}>
                          {tx.type === 'deposit' || tx.type === 'payout' ? '+' : '-'}
                          {formatBsv(tx.amount)}
                        </p>
                        <Badge
                          variant={tx.status === 'confirmed' || tx.status === 'completed' ? 'success' : 'warning'}
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
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}
