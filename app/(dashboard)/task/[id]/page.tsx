"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { Route } from "next"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  Clock,
  Users,
  Bitcoin,
  Shield,
  CheckCircle2,
  Send,
  MessageSquare,
  Star,
  Calendar,
  AlertCircle,
  FileText,
  Zap,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatSatoshis, timeAgo } from "@/lib/utils"
import { cn } from "@/lib/utils"

const difficultyColors = {
  easy: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  hard: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  expert: "bg-red-500/10 text-red-500 border-red-500/20",
}

export default function TaskDetailsPage() {
  const params = useParams()
  const taskId = params.id as string
  const [task, setTask] = useState<any | null>(null)
  const [taskError, setTaskError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<{ id: number; username: string } | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [applyOpen, setApplyOpen] = useState(false)
  const [applyTitle, setApplyTitle] = useState("")
  const [applyMessage, setApplyMessage] = useState("")
  const [submissions, setSubmissions] = useState<any[]>([])
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false)
  const [submissionText, setSubmissionText] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const employerName = task?.employer?.displayName || "Employer"
  const employerAvatar = task?.employer?.avatar || ""
  const employerUsername = task?.employer?.username || ""
  const employerInitial = String(employerName || "E").trim().slice(0, 1).toUpperCase()
  const statusText = String(task?.status || "open").replaceAll("_", " ")
  const lockedRewardTotal = Number(task?.lockedRewardTotal ?? 0)
  const isOwner = Boolean(currentUser?.username && employerUsername && currentUser.username === employerUsername)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setIsLoading(true)
      setTaskError("")
      try {
        const res = await fetch(`/api/marketplace/tasks/${encodeURIComponent(taskId)}`)
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok) throw new Error(data?.message || "Failed to load task")
        setTask(data)
        setApplied(Boolean(data?.myApplication))
      } catch (e) {
        if (cancelled) return
        setTaskError(e instanceof Error ? e.message : "Failed to load task")
        setTask(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [taskId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/auth/me")
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok || !data?.user) return
        setCurrentUser({ id: Number(data.user.id), username: String(data.user.username || "") })
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isOwner) return
    void loadSubmissions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, task?.id])

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto text-sm text-muted-foreground">Loading task…</div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {taskError || "Task not found"}
          </div>
          <div className="mt-4">
            <Link href="/marketplace">
              <Button variant="outline" size="sm">
                Back to Marketplace
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const timelineEvents = [
    {
      id: "created",
      title: "Task Created",
      description: "Task was created",
      timestamp: String(task?.createdAtRaw || task?.createdAt || ""),
      icon: FileText,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    ...(task?.publishedAt
      ? [
          {
            id: "published",
            title: "Task Published",
            description: "Task was posted to the marketplace",
            timestamp: String(task.publishedAt),
            icon: FileText,
            color: "text-emerald-500",
            bgColor: "bg-emerald-500/10",
          },
        ]
      : []),
    ...(task?.myApplication?.createdAt
      ? [
          {
            id: "applied",
            title: "Application Sent",
            description: "You applied to this task",
            timestamp: String(task.myApplication.createdAt),
            icon: Users,
            color: "text-bitcoin-500",
            bgColor: "bg-bitcoin-500/10",
          },
        ]
      : []),
    ...(lockedRewardTotal > 0
      ? [
          {
            id: "funded",
            title: "Escrow Funded",
            description: `${formatSatoshis(lockedRewardTotal)} secured in escrow`,
            timestamp: String(task?.publishedAt || task?.createdAtRaw || task?.createdAt || ""),
            icon: Shield,
            color: "text-bitcoin-500",
            bgColor: "bg-bitcoin-500/10",
          },
        ]
      : []),
  ].filter((e) => e.timestamp)

  async function handleApply() {
    if (!task?.id) return
    setIsApplying(true)
    try {
      const res = await fetch(`/api/marketplace/tasks/${encodeURIComponent(String(task.id))}/apply`, {
        method: "POST",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const message = data?.message || "Failed to apply"
        if (res.status === 409) setApplied(true)
        setApplyTitle("Couldn't apply")
        setApplyMessage(message)
        setApplyOpen(true)
        return
      }

      setApplied(true)
      setTask((prev: any) =>
        prev
          ? {
              ...prev,
              applicants: typeof data?.applicants === "number" ? data.applicants : Number(prev.applicants ?? 0) + 1,
              myApplication: data?.application ?? { status: "applied", createdAt: new Date().toISOString() },
            }
          : prev,
      )
      setApplyTitle("Application sent")
      setApplyMessage("Your application was submitted successfully.")
      setApplyOpen(true)
    } finally {
      setIsApplying(false)
    }
  }

  async function handleSubmitWork() {
    if (!task?.id) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(String(task.id))}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: submissionText }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setApplyTitle("Couldn't submit work")
        setApplyMessage(data?.message || "Submit failed")
        setApplyOpen(true)
        return
      }
      setSubmissionText("")
      setApplyTitle("Work submitted")
      setApplyMessage("Your submission was sent to the employer for review.")
      setApplyOpen(true)
      if (isOwner) void loadSubmissions()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function loadSubmissions() {
    if (!task?.id) return
    setIsLoadingSubmissions(true)
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(String(task.id))}/submissions`)
      const data = await res.json().catch(() => [])
      if (res.ok && Array.isArray(data)) setSubmissions(data)
    } finally {
      setIsLoadingSubmissions(false)
    }
  }

  async function handleApprove(submissionId: number) {
    if (!task?.id) return
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(String(task.id))}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setApplyTitle("Couldn't approve")
        setApplyMessage(data?.message || "Approval failed")
        setApplyOpen(true)
        return
      }
      setApplyTitle("Paid successfully")
      setApplyMessage(`Paid ${formatSatoshis(Number(data?.amount ?? 0))} to freelancer.`)
      setApplyOpen(true)
      await loadSubmissions()
    } catch (e) {
      setApplyTitle("Couldn't approve")
      setApplyMessage(e instanceof Error ? e.message : "Approval failed")
      setApplyOpen(true)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{applyTitle}</DialogTitle>
            <DialogDescription>{applyMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setApplyOpen(false)}
              className="bg-bitcoin-500 hover:bg-bitcoin-600 text-white"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Back Link */}
        <Link href="/marketplace">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Marketplace
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Task Header */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs capitalize",
                    difficultyColors[(task.difficulty as keyof typeof difficultyColors) || "medium"]
                  )}
                >
                  {task.difficulty}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {task.category}
                </Badge>
                <Badge
                  variant={String(task?.status || "open") === "open" ? "success" : "warning"}
                  className="text-xs"
                >
                  {statusText}
                </Badge>
                {task.featured && (
                  <Badge variant="bitcoin" className="text-xs">
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    Featured
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">{task.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Posted {timeAgo(task.createdAt)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Deadline {timeAgo(task.deadline)}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {task.applicants} applicants
                </span>
              </div>
            </div>

            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">{task.description}</p>
              </CardContent>
            </Card>

            {/* Requirements */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {task.skills.map((skill: string) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Submit Work Section */}
            {applied && String(task?.status || "open") === "open" && !isOwner && (
              <Card className="border-bitcoin-500/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Send className="h-5 w-5 text-bitcoin-500" />
                    Submit Work
                  </CardTitle>
                  <CardDescription>
                    Submit your completed work for review
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Describe what you've completed and provide any relevant links or attachments..."
                    className="min-h-[120px]"
                    value={submissionText}
                    onChange={(e) => setSubmissionText(e.target.value)}
                  />
                  <div className="flex items-center justify-between">
                    <Button variant="outline" size="sm">
                      <FileText className="mr-2 h-4 w-4" />
                      Attach Files
                    </Button>
                    <Button
                      onClick={handleSubmitWork}
                      disabled={isSubmitting || !submissionText.trim()}
                      className="bg-bitcoin-500 hover:bg-bitcoin-600 text-white"
                    >
                      {isSubmitting ? (
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          Submit Work
                          <Send className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {isOwner && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Submissions</CardTitle>
                  <CardDescription>Review submissions and approve to pay</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={loadSubmissions} disabled={isLoadingSubmissions}>
                      {isLoadingSubmissions ? "Loading..." : "Refresh"}
                    </Button>
                  </div>
                  {submissions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No submissions yet.</p>
                  ) : (
                    submissions.map((s) => (
                      <div key={s.id} className="p-3 rounded-lg border border-border/50 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium">
                            {s.user?.username ? `@${s.user.username}` : "Freelancer"}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {String(s.status || "submitted").replaceAll("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.message}</p>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(Number(s.id))}
                            disabled={String(s.status) === "paid"}
                            className="bg-bitcoin-500 hover:bg-bitcoin-600 text-white"
                          >
                            Approve & Pay
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )}

            {/* Activity Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {timelineEvents.map((event, index) => (
                    <div key={event.id} className="relative flex gap-4 pb-8 last:pb-0">
                      {index < timelineEvents.length - 1 && (
                        <div className="absolute left-5 top-10 bottom-0 w-px bg-border" />
                      )}
                      <div
                        className={cn(
                          "relative z-10 h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                          event.bgColor
                        )}
                      >
                        <event.icon className={cn("h-5 w-5", event.color)} />
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="font-medium text-sm">{event.title}</p>
                        <p className="text-xs text-muted-foreground">{event.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{timeAgo(event.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Reward Card */}
            <Card className="border-bitcoin-500/20">
              <CardContent className="p-6">
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground mb-1">Reward</p>
                  <div className="flex items-center justify-center gap-2">
                    <Bitcoin className="h-8 w-8 text-bitcoin-500" />
                    <span className="text-3xl font-bold font-mono text-bitcoin-500">
                      {formatSatoshis(task.reward)}
                    </span>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="space-y-3">
                  {["open", "published"].includes(String(task?.status || "open")) ? (
                    <Button
                      onClick={handleApply}
                      disabled={isApplying || applied}
                      className="w-full bg-bitcoin-500 hover:bg-bitcoin-600 text-white"
                    >
                      <Zap className="mr-2 h-4 w-4" />
                      {applied ? "Application Sent" : isApplying ? "Applying..." : "Apply to this task"}
                    </Button>
                  ) : task.status === "in_progress" ? (
                    <Button variant="outline" className="w-full" disabled>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      In Progress
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Completed
                    </Button>
                  )}
                  {applied ? (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-muted-foreground">
                      <p className="font-medium text-emerald-500">Step 1 complete: application sent.</p>
                      <p className="mt-1">Next, use the work submission box on this page when your task is ready.</p>
                    </div>
                  ) : null}
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/messages?user=${encodeURIComponent(employerUsername)}` as Route}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Message Employer
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Employer Profile */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Employer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={employerAvatar} />
                    <AvatarFallback className="text-lg">{employerInitial}</AvatarFallback>
                  </Avatar>
                  <div>
                    <Link
                      href={(employerUsername ? `/profile/${employerUsername}` : "/profile/me") as Route}
                      className="font-semibold hover:text-bitcoin-500 transition-colors"
                    >
                      {employerName}
                    </Link>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="h-3 w-3 fill-bitcoin-500 text-bitcoin-500" />
                      <span>{Number(task?.employer?.reputation ?? 0).toFixed(1)}</span>
                      <span className="mx-1">·</span>
                      <span>{Number(task?.employer?.completedTasks ?? 0)} tasks</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-3">{task?.employer?.bio || ""}</p>
              </CardContent>
            </Card>

            {/* Escrow info will be shown once escrow backend is wired. */}

            {/* Task Stats */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Category</span>
                  <span className="text-sm font-medium">{task.category}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Subcategory</span>
                  <span className="text-sm font-medium">{task.subcategory || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Difficulty</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs capitalize",
                      difficultyColors[(task.difficulty as keyof typeof difficultyColors) || "medium"]
                    )}
                  >
                    {task.difficulty}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Max Applicants</span>
                  <span className="text-sm font-medium">{task.maxApplicants}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
