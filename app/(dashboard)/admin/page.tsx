"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import type { Route } from "next"
import { motion } from "framer-motion"
import {
  Users,
  Shield,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Activity,
  BarChart3,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Ban,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatBsvFromSats } from "@/lib/utils"
import { cn } from "@/lib/utils"

export interface AdminAnalytics {
  totalUsers: number
  totalUsersGrowth: number
  activeTasks: number
  activeTasksGrowth: number
  revenue30d: number
  revenue30dGrowth: number
  disputes: number
  disputesPercentage: number
  disputesGrowth: number
  revenueAddress: string
  revenueData: Array<{ month: string; revenue: number; revenueUsd: number; tasks: number }>
  categoryData: Array<{ name: string; value: number; color: string }>
  users: Array<{
    id: number
    username: string
    email: string
    displayName: string
    avatarUrl: string | null
    completedTasks: number
    tasksCount: number
    balance: number
    walletAddress: string | null
    reputation: number
    isVerified: boolean
    createdAt: string
  }>
  tasks: Array<{
    id: number
    title: string
    category: string
    reward: number
    applicants: number
    status: string
    createdAt: string
  }>
  disputesList: Array<{
    id: number
    taskId: number
    taskTitle: string
    status: string
    reason: string
    openedBy: string
    createdAt: string
  }>
}
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("overview")
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const revenueData = analytics?.revenueData ?? []
  const categoryData = analytics?.categoryData ?? []
  const adminUsers = analytics?.users ?? []
  const adminTasks = analytics?.tasks ?? []
  const disputesList = analytics?.disputesList ?? []
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: "task"; id: number; label: string }
    | { type: "user"; id: number; label: string }
    | null
  >(null)
  const [isDeleting, setIsDeleting] = useState(false)

  async function confirmDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    const endpoint =
      deleteTarget.type === "task"
        ? `/api/admin/tasks/${deleteTarget.id}`
        : `/api/admin/users/${deleteTarget.id}`
    const response = await fetch(endpoint, { method: "DELETE" })
    const data = await response.json().catch(() => null)
    setIsDeleting(false)
    if (!response.ok) {
      setError(data?.message || `Failed to delete ${deleteTarget.type}`)
      return
    }

    setAnalytics((current) => {
      if (!current) return current
      if (deleteTarget.type === "task") {
        return {
          ...current,
          tasks: current.tasks.filter((task) => task.id !== deleteTarget.id),
          activeTasks: Math.max(
            0,
            current.activeTasks -
              (["published", "in_progress", "submitted"].includes(current.tasks.find((task) => task.id === deleteTarget.id)?.status || "") ? 1 : 0),
          ),
        }
      }
      return {
        ...current,
        users: current.users.filter((user) => user.id !== deleteTarget.id),
        totalUsers: Math.max(0, current.totalUsers - 1),
      }
    })
    setDeleteTarget(null)
  }

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch("/api/admin/analytics")
        if (!response.ok) {
          const data = await response.json().catch(() => null)
          throw new Error(data?.message || `Failed to fetch analytics: ${response.statusText}`)
        }
        const data = await response.json()
        setAnalytics(data)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load analytics"
        setError(errorMessage)
        console.error("Error fetching analytics:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">Platform management and analytics</p>
          </div>
          <Badge variant="bitcoin" className="w-fit">
            <Shield className="h-3 w-3 mr-1" />
            Admin Access
          </Badge>
        </div>

        {error ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  {loading ? (
                    <div className="flex items-center gap-2 mt-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <p className="text-xs text-muted-foreground">Loading...</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-2xl font-bold">{analytics?.totalUsers?.toLocaleString() ?? "-"}</p>
                    </>
                  )}
                </div>
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
              </div>
              {analytics && !loading && (
                <div
                  className={cn(
                    "flex items-center gap-1 mt-2 text-xs",
                    analytics.totalUsersGrowth >= 0 ? "text-emerald-500" : "text-red-500"
                  )}
                >
                  {analytics.totalUsersGrowth >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  <span>
                    {analytics.totalUsersGrowth >= 0 ? "+" : ""}
                    {analytics.totalUsersGrowth.toFixed(1)}% this month
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Tasks</p>
                  {loading ? (
                    <div className="flex items-center gap-2 mt-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <p className="text-xs text-muted-foreground">Loading...</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-2xl font-bold">{analytics?.activeTasks?.toLocaleString() ?? "-"}</p>
                    </>
                  )}
                </div>
                <div className="h-10 w-10 rounded-lg bg-bitcoin-500/10 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-bitcoin-500" />
                </div>
              </div>
              {analytics && !loading && (
                <div
                  className={cn(
                    "flex items-center gap-1 mt-2 text-xs",
                    analytics.activeTasksGrowth >= 0 ? "text-emerald-500" : "text-red-500"
                  )}
                >
                  {analytics.activeTasksGrowth >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  <span>
                    {analytics.activeTasksGrowth >= 0 ? "+" : ""}
                    {analytics.activeTasksGrowth.toFixed(1)}% this month
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Revenue (30d)</p>
                  {loading ? (
                    <div className="flex items-center gap-2 mt-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <p className="text-xs text-muted-foreground">Loading...</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-2xl font-bold font-mono">
                        ${analytics?.revenue30d?.toFixed(2) ?? "-"}
                      </p>
                    </>
                  )}
                </div>
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                </div>
              </div>
              {analytics && !loading && (
                <div
                  className={cn(
                    "flex items-center gap-1 mt-2 text-xs",
                    analytics.revenue30dGrowth >= 0 ? "text-emerald-500" : "text-red-500"
                  )}
                >
                  {analytics.revenue30dGrowth >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  <span>
                    {analytics.revenue30dGrowth >= 0 ? "+" : ""}
                    {analytics.revenue30dGrowth.toFixed(1)}% this month
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Disputes</p>
                  {loading ? (
                    <div className="flex items-center gap-2 mt-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <p className="text-xs text-muted-foreground">Loading...</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-2xl font-bold">{analytics?.disputes ?? "-"}</p>
                    </>
                  )}
                </div>
                <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
              </div>
              {analytics && !loading && (
                <div
                  className={cn(
                    "flex items-center gap-1 mt-2 text-xs",
                    analytics.disputesGrowth >= 0 ? "text-red-500" : "text-emerald-500"
                  )}
                >
                  {analytics.disputesGrowth >= 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  <span>
                    {analytics.disputesGrowth >= 0 ? "+" : ""}
                    {analytics.disputesGrowth.toFixed(1)}% ({analytics.disputesPercentage.toFixed(2)}% of users)
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="disputes">Disputes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                  <CardTitle>Revenue Overview</CardTitle>
                  <CardDescription>
                    Platform fees sent to {analytics?.revenueAddress ?? "the platform revenue address"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueData}>
                        <defs>
                          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F7931A" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#F7931A" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${Number(v).toFixed(2)}`} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: number) => [`$${Number(value).toFixed(2)}`, "Revenue"]}
                        />
                        <Area type="monotone" dataKey="revenueUsd" stroke="#F7931A" strokeWidth={2} fill="url(#revenueGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Task Categories</CardTitle>
                  <CardDescription>Distribution of tasks by category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-1 gap-2 mt-4 min-[420px]:grid-cols-2">
                    {categoryData.map((cat) => (
                      <div key={cat.name} className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-xs text-muted-foreground">{cat.name} ({cat.value}%)</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4 mt-6">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>Manage platform users</CardDescription>
                </div>
                <div className="relative w-full sm:w-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search users..." className="w-full pl-10 sm:w-64" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {adminUsers.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">No users found.</div>
                  ) : adminUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border/40 hover:bg-accent/50 transition-colors sm:flex-nowrap sm:gap-4"
                    >
                      <Avatar className="h-10 w-10">
                        {user.avatarUrl ? <AvatarImage src={user.avatarUrl} /> : null}
                        <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{user.displayName}</span>
                          {user.isVerified && (
                            <Badge variant="bitcoin" className="text-[10px]">Verified</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">@{user.username}</p>
                      </div>
                      <div className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
                        <span>{user.tasksCount} tasks</span>
                        <span>{formatBsvFromSats(user.balance)}</span>
                        <span>{user.reputation} rep</span>
                      </div>
                      <div className="ml-auto flex items-center gap-1">
                        <Button variant="ghost" size="icon-sm" asChild>
                          <Link href={`/profile/${user.username}` as Route}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          onClick={() => setDeleteTarget({ type: "user", id: user.id, label: user.displayName })}
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Task Moderation</CardTitle>
                <CardDescription>Review and moderate tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {adminTasks.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">No tasks found.</div>
                  ) : adminTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border/40 hover:bg-accent/50 transition-colors sm:flex-nowrap sm:gap-4"
                    >
                      <div className="h-10 w-10 rounded-lg bg-bitcoin-500/10 flex items-center justify-center shrink-0">
                        <BarChart3 className="h-5 w-5 text-bitcoin-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.category} - {formatBsvFromSats(task.reward)} - {task.applicants} applicants
                        </p>
                      </div>
                      <Badge
                        variant={task.status === "published" || task.status === "in_progress" ? "success" : "warning"}
                        className="text-[10px] shrink-0"
                      >
                        {task.status}
                      </Badge>
                      <div className="ml-auto flex items-center gap-1">
                        <Button variant="ghost" size="icon-sm" asChild>
                          <Link href={`/task/${task.id}` as Route}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          onClick={() => setDeleteTarget({ type: "task", id: task.id, label: task.title })}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="disputes" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Disputes</CardTitle>
                <CardDescription>Newest disputes from the database</CardDescription>
              </CardHeader>
              <CardContent>
                {disputesList.length === 0 ? (
                  <div className="p-12 text-center">
                    <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">No active disputes</h3>
                    <p className="text-sm text-muted-foreground">All transactions are proceeding smoothly</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {disputesList.map((dispute) => (
                      <div key={dispute.id} className="flex items-center gap-4 p-3 rounded-lg border border-border/40 hover:bg-accent/50 transition-colors">
                        <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{dispute.taskTitle}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            Opened by @{dispute.openedBy} - {dispute.reason}
                          </p>
                        </div>
                        <Badge variant={dispute.status === "open" ? "destructive" : "secondary"} className="text-[10px]">
                          {dispute.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Remove {deleteTarget?.type === "user" ? "user" : "task"} permanently?
              </DialogTitle>
              <DialogDescription>
                {deleteTarget?.type === "user"
                  ? `This will permanently remove ${deleteTarget.label} and related account data.`
                  : `This will permanently remove "${deleteTarget?.label}" from tasks and marketplace data.`}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              This action cannot be undone.
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
                {isDeleting ? "Removing..." : "Remove permanently"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  )
}
