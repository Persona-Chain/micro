"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { Route } from "next"
import { motion } from "framer-motion"
import { Trophy, Medal, Crown, Star, Bitcoin, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatSatoshis } from "@/lib/utils"
import { cn } from "@/lib/utils"

type LeaderboardRange = "weekly" | "monthly" | "allTime"

type LeaderboardUser = {
  id: number
  username: string
  displayName: string
  avatarUrl: string | null
  totalEarnedSats?: number
  completedTasks: number
  reputation: number
  totalSpentSats?: number
  tasksCreated?: number
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center">
        <Crown className="h-4 w-4 text-amber-500" />
      </div>
    )
  }
  if (rank === 2) {
    return (
      <div className="h-8 w-8 rounded-full bg-slate-400/20 flex items-center justify-center">
        <Medal className="h-4 w-4 text-slate-400" />
      </div>
    )
  }
  if (rank === 3) {
    return (
      <div className="h-8 w-8 rounded-full bg-orange-600/20 flex items-center justify-center">
        <Medal className="h-4 w-4 text-orange-600" />
      </div>
    )
  }
  return (
    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
      {rank}
    </div>
  )
}

export default function LeaderboardPage() {
  const [timeFilter, setTimeFilter] = useState<LeaderboardRange>("allTime")
  const [topEarners, setTopEarners] = useState<LeaderboardUser[]>([])
  const [topEmployers, setTopEmployers] = useState<LeaderboardUser[]>([])
  const [topReputation, setTopReputation] = useState<LeaderboardUser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadLeaderboard() {
      setIsLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/leaderboard?range=${timeFilter}`, {
          cache: "no-store",
        })

        if (!res.ok) {
          throw new Error("Failed to load leaderboard")
        }

        const data = await res.json()

        if (!mounted) return

        setTopEarners(data.topEarners ?? [])
        setTopEmployers(data.topEmployers ?? [])
        setTopReputation(data.topReputation ?? [])
      } catch (error) {
        if (!mounted) return
        setError(error instanceof Error ? error.message : "Unable to load leaderboard")
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    loadLeaderboard()

    return () => {
      mounted = false
    }
  }, [timeFilter])

  const podiumUsers = [topEarners[1], topEarners[0], topEarners[2]].filter(Boolean)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-bitcoin-500/10 mb-4">
            <Trophy className="h-8 w-8 text-bitcoin-500" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-muted-foreground mt-1">Top performers on Bountybee</p>
        </div>

        {/* Time Filter */}
        <div className="flex flex-wrap justify-center gap-2">
          {(["weekly", "monthly", "allTime"] as const).map((filter) => (
            <Button
              key={filter}
              variant={timeFilter === filter ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTimeFilter(filter)}
              className={cn(timeFilter === filter && "bg-bitcoin-500/10 text-bitcoin-500")}
            >
              {filter === "allTime" ? "All Time" : filter === "weekly" ? "This Week" : "This Month"}
            </Button>
          ))}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Top 3 Podium */}
        <div className="grid grid-cols-1 gap-4 items-end sm:grid-cols-3">
          {podiumUsers.length ? (
            podiumUsers.map((user, index) => {
              const heights = ["h-20 sm:h-48", "h-24 sm:h-64", "h-16 sm:h-40"]
              const positions = [2, 1, 3]
              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex flex-col items-center"
                >
                  <Link href={`/profile/${user.username}` as Route}>
                    <div className="text-center space-y-2 mb-4">
                      <div className="relative inline-block">
                        <Avatar
                          className={cn(
                            "ring-4",
                            index === 1 ? "h-20 w-20 ring-amber-500/30" : "h-16 w-16 ring-muted"
                          )}
                        >
                          <AvatarImage src={user.avatarUrl || undefined} />
                          <AvatarFallback className="text-xl">{user.displayName[0]}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                          <RankBadge rank={positions[index]} />
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{user.displayName}</p>
                        <p className="text-xs text-bitcoin-500 font-mono">
                          {formatSatoshis(user.totalEarnedSats ?? 0)}
                        </p>
                      </div>
                    </div>
                  </Link>
                  <div
                    className={cn(
                      "w-full rounded-t-xl bg-gradient-to-t from-bitcoin-500/20 to-bitcoin-500/5",
                      heights[index]
                    )}
                  />
                </motion.div>
              )
            })
          ) : (
            <div className="sm:col-span-3 rounded-xl border border-border/40 bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
              {isLoading ? "Loading leaderboard..." : "No top earners available yet."}
            </div>
          )}
        </div>

        <Tabs defaultValue="earners" className="space-y-6">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="earners" className="gap-2">
              <Bitcoin className="h-4 w-4" />
              Top Earners
            </TabsTrigger>
            <TabsTrigger value="employers" className="gap-2">
              <Users className="h-4 w-4" />
              Top Employers
            </TabsTrigger>
            <TabsTrigger value="reputation" className="gap-2">
              <Star className="h-4 w-4" />
              Reputation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="earners" className="space-y-2">
            <Card>
              {topEarners.length ? (
                topEarners.map((user, index) => (
                  <Link key={user.id} href={`/profile/${user.username}` as Route}>
                    <div className="flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors border-b border-border/40 last:border-0">
                      <span className="text-sm font-bold text-muted-foreground w-6 text-center">
                        {index + 1}
                      </span>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatarUrl || undefined} />
                        <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{user.displayName}</p>
                        <p className="text-xs text-muted-foreground">@{user.username}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-semibold text-bitcoin-500">
                          {formatSatoshis(user.totalEarnedSats ?? 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">{user.completedTasks} tasks</p>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {isLoading ? "Loading earners..." : "No earner data available."}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="employers" className="space-y-2">
            <Card>
              {topEmployers.length ? (
                topEmployers.map((user, index) => (
                  <Link key={user.id} href={`/profile/${user.username}` as Route}>
                    <div className="flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors border-b border-border/40 last:border-0">
                      <span className="text-sm font-bold text-muted-foreground w-6 text-center">
                        {index + 1}
                      </span>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatarUrl || undefined} />
                        <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{user.displayName}</p>
                        <p className="text-xs text-muted-foreground">@{user.username}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{user.tasksCreated ?? 0} tasks</p>
                        <p className="text-xs text-muted-foreground">{formatSatoshis(user.totalSpentSats ?? 0)} spent</p>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {isLoading ? "Loading employers..." : "No employer data available."}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="reputation" className="space-y-2">
            <Card>
              {topReputation.length ? (
                topReputation.map((user, index) => (
                  <Link key={user.id} href={`/profile/${user.username}` as Route}>
                    <div className="flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors border-b border-border/40 last:border-0">
                      <span className="text-sm font-bold text-muted-foreground w-6 text-center">
                        {index + 1}
                      </span>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatarUrl || undefined} />
                        <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{user.displayName}</p>
                        <p className="text-xs text-muted-foreground">@{user.username}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-bitcoin-500 text-bitcoin-500" />
                        <span className="font-semibold">{user.reputation}</span>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {isLoading ? "Loading reputation..." : "No reputation data available."}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  )
}
