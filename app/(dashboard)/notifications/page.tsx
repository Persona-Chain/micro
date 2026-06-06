"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import {
  Bell,
  CheckCircle2,
  Trash2,
  Bitcoin,
  MessageSquare,
  Shield,
  Zap,
  Clock,
  Check,
  Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { timeAgo } from "@/lib/utils"
import { cn } from "@/lib/utils"

const typeConfig = {
  task: { icon: CheckCircle2, color: "text-blue-500", bg: "bg-blue-500/10" },
  payment: { icon: Bitcoin, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  message: { icon: MessageSquare, color: "text-bitcoin-500", bg: "bg-bitcoin-500/10" },
  escrow: { icon: Shield, color: "text-purple-500", bg: "bg-purple-500/10" },
  system: { icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10" },
}

type NotificationItem = {
  id: number
  type: string
  message: string
  link?: string | null
  read: boolean
  createdAt: string
}

function newestFirst(notifications: NotificationItem[]) {
  return [...notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState("all")
  const [notifs, setNotifs] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const unreadCount = notifs.filter((n) => !n.read).length

  useEffect(() => {
    async function loadNotifications() {
      try {
        const res = await fetch("/api/dashboard/notifications", { cache: "no-store" })
        if (!res.ok) throw new Error("Failed to load notifications")
        const data = await res.json()
        setNotifs(Array.isArray(data) ? newestFirst(data) : [])
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }

    loadNotifications()
  }, [])

  const filteredNotifs = newestFirst(notifs).filter((n) => {
    if (activeTab === "all") return true
    if (activeTab === "unread") return !n.read
    return n.type === activeTab
  })

  function markAllAsRead() {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  function markAsRead(id: number) {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  if (error) {
    return (
      <div className="p-6 text-center text-destructive">
        <p className="text-lg font-semibold">Unable to load notifications</p>
        <p className="mt-2 text-sm">{error}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p className="text-lg font-semibold">Loading notifications...</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Notifications - Activity feed</h1>
            <p className="text-muted-foreground mt-1">
              {unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.`
                : "You are all caught up."
              }
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            <Check className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="all">
              All
              <Badge variant="secondary" className="ml-2 text-[10px]">
                {notifs.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="unread">
              Unread
              <Badge variant="bitcoin" className="ml-2 text-[10px]">
                {notifs.filter((n) => !n.read).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="task">Tasks</TabsTrigger>
            <TabsTrigger value="payment">Payments</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            <Card>
              <ScrollArea className="h-[calc(100dvh-18rem)] min-h-[320px] sm:h-[600px]">
                <div className="divide-y divide-border/40">
                  {filteredNotifs.length > 0 ? (
                    filteredNotifs.map((notif) => {
                      const config =
                        typeConfig[notif.type as keyof typeof typeConfig] ?? typeConfig.system
                      const Icon = config.icon

                      return (
                        <motion.div
                          key={notif.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={cn(
                            "flex items-start gap-4 p-4 transition-colors hover:bg-accent/50",
                            !notif.read && "bg-accent/30"
                          )}
                        >
                          <div
                            className={cn(
                              "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                              config.bg
                            )}
                          >
                            <Icon className={cn("h-5 w-5", config.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-sm">{notif.type === "payment" ? "Payment update" : notif.type === "task" ? "Task update" : notif.type === "escrow" ? "Escrow update" : "Notification"}</p>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  {notif.message}
                                </p>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {timeAgo(notif.createdAt)}
                                  </span>
                                  {notif.link && (
                                    <a
                                      href={notif.link}
                                      className="text-xs text-bitcoin-500 hover:underline"
                                    >
                                      View details
                                    </a>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {!notif.read && (
                                  <button
                                    onClick={() => markAsRead(notif.id)}
                                    className="h-2 w-2 rounded-full bg-bitcoin-500"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })
                  ) : (
                    <div className="p-12 text-center">
                      <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <h3 className="text-lg font-semibold mb-2">No notifications</h3>
                      <p className="text-sm text-muted-foreground">
                        You&apos;re all caught up!
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  )
}
