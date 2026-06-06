"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Bitcoin,
  Shield,
  FileText,
  Tag,
  DollarSign,
  Eye,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { categories } from "@/data/sample-data"
import { formatSatoshis } from "@/lib/utils"
import { cn } from "@/lib/utils"

const steps = [
  { id: 1, title: "Task Details", icon: FileText },
  { id: 2, title: "Description", icon: Tag },
  { id: 3, title: "Reward", icon: DollarSign },
  { id: 4, title: "Review", icon: Eye },
]

const difficulties = ["easy", "medium", "hard", "expert"] as const
const FALLBACK_BSV_PRICE_USD = 40

function CreateTaskContent() {
  const searchParams = useSearchParams()
  const editTaskId = searchParams.get("edit")
  const hireUsername = searchParams.get("hire")?.trim() || ""
  const [currentStep, setCurrentStep] = useState(1)
  const [isPublishing, setIsPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [taskId, setTaskId] = useState<number | null>(null)
  const [editStatus, setEditStatus] = useState<string | null>(null)
  const [apiError, setApiError] = useState("")
  const [errorOpen, setErrorOpen] = useState(false)
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false)
  const [errorTitle, setErrorTitle] = useState("Fix the highlighted fields")
  const [errorMessages, setErrorMessages] = useState<string[]>([])
  const [dbCategories, setDbCategories] = useState<Array<{ id: number; name: string }>>([])
  const [bsvPriceUsd, setBsvPriceUsd] = useState<number>(FALLBACK_BSV_PRICE_USD)
  const [isEstimatedPrice, setIsEstimatedPrice] = useState(true)
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    subcategory: "",
    difficulty: "medium" as typeof difficulties[number],
    description: "",
    requirements: "",
    reward: 100000,
    maxApplicants: 10,
    deadline: "",
    skills: [] as string[],
    skillInput: "",
  })

  const progress = ((currentStep - 1) / (steps.length - 1)) * 100
  const isEditing = Boolean(editTaskId)
  const today = new Date().toISOString().slice(0, 10)
  const rewardUsd = (Number(formData.reward || 0) / 100_000_000) * bsvPriceUsd
  const publishFeeUsd = 0.01
  const publishFeeSats = bsvPriceUsd ? Math.ceil((publishFeeUsd / bsvPriceUsd) * 100_000_000) : null

  function updateField(field: string, value: string | number) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  function addSkill() {
    if (formData.skillInput.trim() && !formData.skills.includes(formData.skillInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        skills: [...prev.skills, prev.skillInput.trim()],
        skillInput: "",
      }))
    }
  }

  function removeSkill(skill: string) {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }))
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (editTaskId) {
          const res = await fetch(`/api/tasks/${encodeURIComponent(editTaskId)}`, { method: "GET" })
          const data = await res.json().catch(() => null)
          if (cancelled) return
          if (!res.ok) throw new Error(data?.message || "Failed to load task")

          setTaskId(Number(data?.id))
          setEditStatus(String(data?.status || "draft"))
          const expiration = data?.expirationDate ? new Date(data.expirationDate) : null
          setFormData((prev) => ({
            ...prev,
            title: String(data?.title || ""),
            category: String(data?.category?.name || ""),
            description: String(data?.fullDescription || data?.shortDescription || ""),
            requirements: String(data?.requirements || ""),
            reward: Number(data?.rewardAmount || prev.reward),
            maxApplicants: Number(data?.maxWorkers || prev.maxApplicants),
            deadline:
              expiration && Number.isFinite(expiration.getTime())
                ? expiration.toISOString().slice(0, 10)
                : "",
            skills: Array.isArray(data?.tags) ? data.tags.map((item: any) => String(item?.tag?.name || "")).filter(Boolean) : [],
          }))
          return
        }

        const res = await fetch("/api/tasks/draft", { method: "POST" })
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok) throw new Error(data?.message || "Failed to create draft task")
        setTaskId(Number(data?.taskId))
      } catch (e) {
        if (cancelled) return
        setApiError(e instanceof Error ? e.message : "Failed to create draft task")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editTaskId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/market/bsv-price", { method: "GET", cache: "no-store" })
        const data = await res.json().catch(() => null)
        if (cancelled) return
        const usd = Number(data?.usd)
        if (res.ok && Number.isFinite(usd) && usd > 0) {
          setBsvPriceUsd(usd)
          setIsEstimatedPrice(Boolean(data?.estimated))
        }
      } catch {
        // USD display is optional.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/categories", { method: "GET" })
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok || !Array.isArray(data)) return
        setDbCategories(
          data
            .map((c: any) => ({ id: Number(c?.id), name: String(c?.name || "") }))
            .filter((c: any) => Number.isFinite(c.id) && c.name),
        )
      } catch {
        // Silent fallback: UI can still render sample categories; we only need numeric ids for the API.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function showErrorDialog(title: string, messages: string[]) {
    setErrorTitle(title)
    setErrorMessages(messages.length ? messages : ["Something went wrong. Please try again."])
    setErrorOpen(true)
  }

  function extractMessages(data: any) {
    const fieldLabel: Record<string, string> = {
      title: "Title",
      shortDescription: "Short description",
      categoryId: "Category",
      tags: "Tags",
      fullDescription: "Description",
      requirements: "Requirements",
      rewardAmount: "Reward",
      maxWorkers: "Max workers",
      expirationDate: "Expiration date",
    }
    const messages: string[] = []
    const fieldErrors = data?.details?.fieldErrors
    const formErrors = data?.details?.formErrors
    if (fieldErrors && typeof fieldErrors === "object") {
      for (const [field, errs] of Object.entries(fieldErrors)) {
        if (Array.isArray(errs) && errs.length) {
          const label = fieldLabel[field] ?? field
          messages.push(`${label}: ${errs[0]}`)
        }
      }
    }
    if (Array.isArray(formErrors)) {
      for (const e of formErrors) {
        if (typeof e === "string" && e.trim()) messages.push(e)
      }
    }
    if (!messages.length && typeof data?.message === "string") messages.push(data.message)
    return messages
  }

  async function saveStep(step: number) {
    if (!taskId) throw new Error("Draft task not ready yet")
    setApiError("")

    if (step === 1) {
      let dbCat = dbCategories.find((c) => c.name === formData.category)
      if (!dbCat) {
        try {
          const res = await fetch("/api/categories", { method: "GET" })
          const data = await res.json().catch(() => null)
          if (res.ok && Array.isArray(data)) {
            const fresh = data
              .map((c: any) => ({ id: Number(c?.id), name: String(c?.name || "") }))
              .filter((c: any) => Number.isFinite(c.id) && c.name)
            setDbCategories(fresh)
            dbCat = fresh.find((c: any) => c.name === formData.category)
          }
        } catch {
          // ignore
        }
      }

      const categoryId = Number(dbCat?.id)
      if (!Number.isFinite(categoryId)) throw new Error("Please select a category")
      const shortDescription = (formData.description || formData.title || "").slice(0, 280)
      const payload = {
        title: formData.title,
        shortDescription: shortDescription || formData.title,
        categoryId,
        tags: formData.skills,
      }
      const res = await fetch(`/api/tasks/${taskId}/step/1`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(extractMessages(data).join("\n") || "Step 1 failed")
      return
    }

    if (step === 2) {
      const payload = {
        fullDescription: formData.description,
        requirements: formData.requirements,
        instructions: "",
      }
      const res = await fetch(`/api/tasks/${taskId}/step/2`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(extractMessages(data).join("\n") || "Step 2 failed")
      return
    }

    if (step === 3) {
      const payload = {
        rewardAmount: formData.reward,
        currency: "BSV",
        maxWorkers: formData.maxApplicants,
      }
      const res = await fetch(`/api/tasks/${taskId}/step/3`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(extractMessages(data).join("\n") || "Step 3 failed")
      return
    }

    if (step === 4) {
      const expirationDate = formData.deadline ? new Date(`${formData.deadline}T23:59:59.999`).toISOString() : undefined
      const payload = {
        expirationDate,
        visibility: "public",
        featuredTask: false,
        autoApprove: false,
      }
      const res = await fetch(`/api/tasks/${taskId}/step/4`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(extractMessages(data).join("\n") || "Step 4 failed")
      return
    }
  }

  async function handlePublish() {
    setPublishConfirmOpen(false)
    setIsPublishing(true)
    setApiError("")
    try {
      // Ensure earlier steps are saved (best-effort).
      await saveStep(1)
      await saveStep(2)
      await saveStep(3)
      await saveStep(4)

      if (!taskId) throw new Error("Draft task not ready yet")
      if (editStatus !== "published") {
        const res = await fetch(`/api/tasks/${taskId}/publish`, { method: "POST" })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.message || "Publish failed")
      }

      setPublished(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Publish failed"
      setApiError(msg)
      showErrorDialog("Couldn't publish task", msg.split("\n").filter(Boolean))
    } finally {
      setIsPublishing(false)
    }
  }

  function requestPublish() {
    if (isEditing) {
      void handlePublish()
      return
    }
    setPublishConfirmOpen(true)
  }

  const selectedCategory = categories.find((c) => c.name === formData.category)

  if (published) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg mx-auto text-center space-y-6 py-12"
        >
          <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">{isEditing ? "Task Updated!" : "Task Published!"}</h2>
            <p className="text-muted-foreground">
              {isEditing
                ? "Your task changes have been saved."
                : "Your task has been posted to the marketplace. Freelancers can now apply."}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-muted text-left">
            <p className="font-medium">{formData.title}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Reward: {formatSatoshis(formData.reward)}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" asChild>
              <a href={taskId ? `/task/${taskId}` : "/marketplace"}>View Task</a>
            </Button>
            <Button className="bg-bitcoin-500 hover:bg-bitcoin-600 text-white" asChild>
              <a href="/create-task">
              Post Another Task
              </a>
            </Button>
          </div>
        </motion.div>
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
          {apiError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
              {apiError}
            </div>
          )}

          {hireUsername && !isEditing ? (
            <div className="rounded-lg border border-bitcoin-500/20 bg-bitcoin-500/5 p-3 text-sm">
              Creating a task for <span className="font-medium text-bitcoin-500">@{hireUsername}</span>. Publish it, then message the freelancer with the task link.
            </div>
          ) : null}

          <Dialog open={errorOpen} onOpenChange={setErrorOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{errorTitle}</DialogTitle>
                <DialogDescription>Update the fields below and try again.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                {errorMessages.map((m, idx) => (
                  <div key={idx} className="text-sm p-2 rounded-md bg-destructive/10 border border-destructive/20">
                    {m}
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button onClick={() => setErrorOpen(false)} className="bg-bitcoin-500 hover:bg-bitcoin-600 text-white">
                  OK
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm task publish fee</DialogTitle>
                <DialogDescription>
                  Publishing a task costs $0.01. This fee will be deducted from your balance before the task goes live.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="rounded-lg border border-bitcoin-500/20 bg-bitcoin-500/5 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Publish fee</span>
                    <span className="font-medium">
                      $0.01{publishFeeSats ? ` (${formatSatoshis(publishFeeSats)})` : ""}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-muted-foreground">Reward escrow</span>
                    <span className="font-medium">{formatSatoshis(formData.reward)}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  The reward is locked in escrow. The $0.01 publish fee is credited to the platform admin account.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPublishConfirmOpen(false)} disabled={isPublishing}>
                  Cancel
                </Button>
                <Button onClick={handlePublish} disabled={isPublishing} className="bg-bitcoin-500 hover:bg-bitcoin-600 text-white">
                  {isPublishing ? "Publishing..." : "Confirm & Publish"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{isEditing ? "Edit Task" : "Create a Task"}</h1>
          <p className="text-muted-foreground mt-1">
            {isEditing ? "Update your task details and save changes" : "Post a task and get it completed by talented freelancers"}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="space-y-4">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between">
            {steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-2",
                  currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    currentStep > step.id
                      ? "bg-emerald-500 text-white"
                      : currentStep === step.id
                      ? "bg-bitcoin-500 text-white"
                      : "bg-muted"
                  )}
                >
                  {currentStep > step.id ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <step.icon className="h-4 w-4" />
                  )}
                </div>
                <span className="hidden sm:inline text-sm font-medium">{step.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Task Details</CardTitle>
                  <CardDescription>Basic information about your task</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Task Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Design a Bitcoin SV Logo"
                      value={formData.title}
                      onChange={(e) => updateField("title", e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                        {categories.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => updateField("category", cat.name)}
                            className={cn(
                              "p-3 rounded-lg border text-sm font-medium transition-all duration-200 text-left",
                              formData.category === cat.name
                                ? "border-bitcoin-500 bg-bitcoin-500/10 text-bitcoin-500"
                                : "border-border hover:bg-accent"
                            )}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Subcategory</Label>
                      <div className="space-y-2">
                        {selectedCategory ? (
                          selectedCategory.subcategories.map((sub) => (
                            <button
                              key={sub}
                              onClick={() => updateField("subcategory", sub)}
                              className={cn(
                                "w-full p-2 rounded-lg border text-sm transition-all duration-200 text-left",
                                formData.subcategory === sub
                                  ? "border-bitcoin-500 bg-bitcoin-500/10 text-bitcoin-500"
                                  : "border-border hover:bg-accent"
                              )}
                            >
                              {sub}
                            </button>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground p-2">
                            Select a category first
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Difficulty</Label>
                    <div className="flex flex-col gap-2 min-[420px]:flex-row">
                      {difficulties.map((diff) => (
                        <button
                          key={diff}
                          onClick={() => updateField("difficulty", diff)}
                          className={cn(
                            "flex-1 p-2 rounded-lg border text-sm font-medium capitalize transition-all duration-200",
                            formData.difficulty === diff
                              ? "border-bitcoin-500 bg-bitcoin-500/10 text-bitcoin-500"
                              : "border-border hover:bg-accent"
                          )}
                        >
                          {diff}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                  <CardDescription>Describe your task in detail</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="description">Task Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe what needs to be done, deliverables, and any specific requirements..."
                      className="min-h-[150px]"
                      value={formData.description}
                      onChange={(e) => updateField("description", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="requirements">Requirements</Label>
                    <Textarea
                      id="requirements"
                      placeholder="List any specific skills, tools, or experience required..."
                      className="min-h-[100px]"
                      value={formData.requirements}
                      onChange={(e) => updateField("requirements", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Skills Required</Label>
                    <div className="flex flex-col gap-2 min-[420px]:flex-row">
                      <Input
                        placeholder="Add a skill and press Enter"
                        value={formData.skillInput}
                        onChange={(e) => updateField("skillInput", e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            addSkill()
                          }
                        }}
                      />
                      <Button type="button" variant="outline" onClick={addSkill}>
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.skills.map((skill) => (
                        <Badge key={skill} variant="secondary" className="cursor-pointer" onClick={() => removeSkill(skill)}>
                          {skill} Ã—
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>Reward & Settings</CardTitle>
                  <CardDescription>Set the reward and task parameters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reward">Reward (sats)</Label>
                    <div className="relative">
                      <Bitcoin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-bitcoin-500" />
                      <Input
                        id="reward"
                        type="number"
                        className="pl-10"
                        value={formData.reward}
                        onChange={(e) => updateField("reward", parseInt(e.target.value))}
                        min={10000}
                        step={10000}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      About ${rewardUsd.toFixed(2)} USD at ${bsvPriceUsd.toFixed(2)} / BSV
                      {isEstimatedPrice ? " (estimated)" : ""}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxApplicants">Max Applicants</Label>
                      <Input
                        id="maxApplicants"
                        type="number"
                        value={formData.maxApplicants}
                        onChange={(e) => updateField("maxApplicants", parseInt(e.target.value))}
                        min={1}
                        max={50}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deadline">Deadline</Label>
                      <Input
                        id="deadline"
                        type="date"
                        value={formData.deadline}
                        onChange={(e) => updateField("deadline", e.target.value)}
                        min={today}
                      />
                    </div>
                  </div>

                  <Card className="bg-bitcoin-500/5 border-bitcoin-500/20">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-bitcoin-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">Escrow Protection</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            The reward will be held in escrow until the task is completed and approved.
                            This protects both you and the freelancer.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>
            )}

            {currentStep === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle>Review & Publish</CardTitle>
                  <CardDescription>Review your task before publishing</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Title</p>
                      <p className="font-medium">{formData.title || "Not set"}</p>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Category</p>
                        <p className="font-medium">{formData.category || "Not set"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Subcategory</p>
                        <p className="font-medium">{formData.subcategory || "Not set"}</p>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p className="text-sm mt-1">{formData.description || "Not set"}</p>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Reward</p>
                        <p className="font-medium text-bitcoin-500">{formatSatoshis(formData.reward)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Difficulty</p>
                        <Badge variant="outline" className="capitalize">
                          {formData.difficulty}
                        </Badge>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground">Skills</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {formData.skills.length > 0 ? (
                          formData.skills.map((skill) => (
                            <Badge key={skill} variant="secondary">{skill}</Badge>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No skills added</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Platform Fee</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Publishing costs $0.01{publishFeeSats ? ` (${formatSatoshis(publishFeeSats)})` : ""}.
                        This fee is deducted from your balance before publishing. Total escrow amount: {formatSatoshis(formData.reward)}.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {currentStep < steps.length ? (
            <Button
              onClick={async () => {
                try {
                  await saveStep(currentStep)
                  setCurrentStep((prev) => Math.min(steps.length, prev + 1))
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "Failed to save step"
                  setApiError(msg)
                  showErrorDialog("Please fix these issues", msg.split("\n").filter(Boolean))
                }
              }}
              className="bg-bitcoin-500 hover:bg-bitcoin-600 text-white"
              disabled={!taskId}
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={requestPublish}
              disabled={isPublishing}
              className="bg-bitcoin-500 hover:bg-bitcoin-600 text-white"
            >
              {isPublishing ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isEditing ? "Save Changes" : "Publish Task"}
                  <CheckCircle2 className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default function CreateTaskPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="text-sm text-muted-foreground">Loading task editor...</div>
        </div>
      }
    >
      <CreateTaskContent />
    </Suspense>
  )
}


