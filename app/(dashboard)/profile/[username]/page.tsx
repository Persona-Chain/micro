"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import Link from "next/link"
import type { Route } from "next"
import {
  Star,
  CheckCircle2,
  Clock,
  Bitcoin,
  Trophy,
  Calendar,
  MapPin,
  Link as LinkIcon,
  Grid3X3,
  List,
  MessageSquare,
  Zap,
  Trash2,
  Pencil,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatSatoshis, timeAgo, truncate } from "@/lib/utils"
import { cn } from "@/lib/utils"

export default function ProfilePage() {
  const params = useParams()
  const username = params.username as string
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [profileData, setProfileData] = useState<any | null>(null)
  const [tasksData, setTasksData] = useState<{ created: any[]; completed: any[] } | null>(null)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [currentUsername, setCurrentUsername] = useState("")
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null)
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<{ id: number; title: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setIsLoading(true)
      setError("")
      try {
        const [profileRes, tasksRes, authRes] = await Promise.all([
          fetch(`/api/profile/${encodeURIComponent(username)}`),
          fetch(`/api/profile/${encodeURIComponent(username)}/tasks`),
          fetch("/api/auth/me", { cache: "no-store" }),
        ])

        const profileJson = await profileRes.json().catch(() => null)
        const tasksJson = await tasksRes.json().catch(() => null)
        const authJson = await authRes.json().catch(() => null)
        if (cancelled) return

        if (!profileRes.ok) throw new Error(profileJson?.message || "Failed to load profile")
        setProfileData(profileJson)
        if (tasksRes.ok) setTasksData(tasksJson)
        if (authRes.ok) setCurrentUsername(String(authJson?.user?.username || ""))
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to load profile")
        setProfileData(null)
        setTasksData(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [username])

  const profile = profileData?.profile
  const stats = profileData?.stats
  const reviews = Array.isArray(profileData?.reviews) ? profileData.reviews : []
  const portfolio = Array.isArray(profileData?.portfolio) ? profileData.portfolio : []

  const tasks = useMemo(() => {
    const created = tasksData?.created || []
    const completed = tasksData?.completed || []
    return [...created, ...completed]
  }, [tasksData])

  const displayName = String(profile?.displayName || profile?.username || username || "User")
  const isOwnProfile = currentUsername === String(profile?.username || username)
  const avatarUrl =
    String(profile?.avatarUrl || "") ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(String(profile?.username || username || "user"))}`

  const reputationScore = Number(stats?.reputationScore ?? profile?.reputationScore ?? 0)
  const reputationLevel = Math.floor(reputationScore / 100)
  const reputationProgress = Math.min(100, Math.max(0, reputationScore % 100))

  async function deleteProfileTask() {
    if (!deleteTaskTarget) return
    const taskId = deleteTaskTarget.id
    setDeletingTaskId(taskId)
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || "Failed to delete task")

      setTasksData((current) => {
        if (!current) return current
        return {
          created: current.created.filter((task) => task.id !== taskId),
          completed: current.completed.filter((task) => task.id !== taskId),
        }
      })
      setDeleteTaskTarget(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete task")
    } finally {
      setDeletingTaskId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="text-sm text-muted-foreground">Loading profile…</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error || "Profile not found"}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-bitcoin-500/5 via-transparent to-bitcoin-600/5" />
          <CardContent className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="relative">
                <Avatar className="h-24 w-24 ring-4 ring-background">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="text-2xl">{displayName.slice(0, 1)}</AvatarFallback>
                </Avatar>
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-bold">{displayName}</h1>
                </div>
                <p className="text-muted-foreground">@{profile.username}</p>
                {profile.bio ? <p className="text-sm max-w-xl">{profile.bio}</p> : null}

                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Joined {timeAgo(profile.createdAt)}
                  </span>
                  {profile.location ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {profile.location}
                    </span>
                  ) : null}
                  {profile.website ? (
                    <span className="flex items-center gap-1">
                      <LinkIcon className="h-4 w-4" />
                      {profile.website}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {!isOwnProfile ? (
                  <>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/messages?user=${encodeURIComponent(String(profile.username))}` as Route}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Message
                      </Link>
                    </Button>
                    <Button size="sm" className="bg-bitcoin-500 hover:bg-bitcoin-600 text-white" asChild>
                      <Link href={`/create-task?hire=${encodeURIComponent(String(profile.username))}` as Route}>
                        <Zap className="mr-2 h-4 w-4" />
                        Hire
                      </Link>
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Star className="h-5 w-5 text-bitcoin-500 fill-bitcoin-500" />
                <span className="text-2xl font-bold">
                  {Number(stats?.averageRating ?? profile.averageRating ?? 0).toFixed(1)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Rating</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
              <span className="text-2xl font-bold">{Number(stats?.completedTasks ?? profile.totalCompletedTasks ?? 0)}</span>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Bitcoin className="h-5 w-5 text-bitcoin-500 mx-auto mb-1" />
              <span className="text-2xl font-bold font-mono">{formatSatoshis(Number(stats?.totalEarnedSats ?? 0))}</span>
              <p className="text-xs text-muted-foreground">Total Earned</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Trophy className="h-5 w-5 text-amber-500 mx-auto mb-1" />
              <span className="text-2xl font-bold">{reputationScore}</span>
              <p className="text-xs text-muted-foreground">Reputation</p>
              <Progress value={reputationProgress} className="h-1 mt-2" />
              <p className="text-[10px] text-muted-foreground mt-1">Level {reputationLevel}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="tasks" className="space-y-6">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-bitcoin-500">
                  All
                </Button>
              </div>
              <div className="flex gap-1">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {tasks.length > 0 ? (
              <div
                className={cn(
                  "grid gap-4",
                  viewMode === "grid" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1",
                )}
              >
                {tasks.map((task: any) => (
                  <Card key={task.id} className="group hover:border-bitcoin-500/30 transition-all duration-300">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <Link href={`/task/${task.id}` as Route} className="min-w-0 flex-1">
                          <h3 className="font-medium group-hover:text-bitcoin-500 transition-colors">
                            {truncate(task.title, 60)}
                          </h3>
                        </Link>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant={
                              String(task.status) === "completed"
                                ? "success"
                                : String(task.status) === "published"
                                  ? "outline"
                                  : "warning"
                            }
                            className="text-[10px]"
                          >
                            {String(task.status || "").replaceAll("_", " ")}
                          </Badge>
                          {isOwnProfile && task.role === "employer" ? (
                            <>
                              <Button variant="ghost" size="icon-sm" asChild>
                                <Link href={`/create-task?edit=${task.id}` as Route}>
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive"
                                onClick={() => setDeleteTaskTarget({ id: Number(task.id), title: String(task.title || `Task #${task.id}`) })}
                                disabled={deletingTaskId === Number(task.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{formatSatoshis(Number(task.rewardAmount ?? 0))}</span>
                        <span>{timeAgo(task.createdAt)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No tasks yet</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="reviews" className="space-y-4">
            {reviews.length > 0 ? (
              reviews.map((review: any) => (
                <Card key={review.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(String(review.reviewer || "reviewer"))}`}
                        />
                        <AvatarFallback>{String(review.reviewer || "R").slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">@{review.reviewer}</p>
                            <p className="text-xs text-muted-foreground">{timeAgo(review.createdAt)}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-bitcoin-500 fill-bitcoin-500" />
                            <span className="text-sm font-medium">{review.rating}</span>
                          </div>
                        </div>
                        {review.comment ? <p className="text-sm text-muted-foreground mt-2">{review.comment}</p> : null}
                        {review.task?.title ? (
                          <p className="text-xs text-muted-foreground mt-2">Task: {review.task.title}</p>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="p-12 text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No reviews yet</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="portfolio" className="space-y-4">
            {portfolio.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {portfolio.map((p: any) => (
                  <Card key={p.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{p.title}</CardTitle>
                      {p.projectUrl ? <CardDescription>{p.projectUrl}</CardDescription> : null}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {p.description ? <p className="text-sm text-muted-foreground">{p.description}</p> : null}
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt={p.title} className="w-full rounded-md border border-border/50" />
                      ) : null}
                      <p className="text-xs text-muted-foreground">{timeAgo(p.createdAt)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No portfolio yet</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={Boolean(deleteTaskTarget)} onOpenChange={(open) => !open && setDeleteTaskTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove this task permanently?</DialogTitle>
              <DialogDescription>
                This will remove "{deleteTaskTarget?.title}" from your profile and marketplace data.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              This action cannot be undone. If funds are locked for this task, they will be returned to your available balance.
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTaskTarget(null)} disabled={Boolean(deletingTaskId)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={deleteProfileTask} disabled={Boolean(deletingTaskId)}>
                {deletingTaskId ? "Removing..." : "Remove task"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  )
}
