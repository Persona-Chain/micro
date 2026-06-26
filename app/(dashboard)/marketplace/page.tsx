"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import type { Route } from "next"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  Clock,
  Users,
  Star,
  Filter,
  X,
  Bitcoin,
  ArrowUpDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createFavoriteTask, useFavoriteTasks, type FavoriteTask } from "@/hooks/use-favorite-tasks"
import { formatSatoshis, timeAgo, truncate } from "@/lib/utils"
import { cn } from "@/lib/utils"

const sortOptions = [
  { value: "newest", label: "Newest First" },
  { value: "reward-high", label: "Highest Reward" },
  { value: "reward-low", label: "Lowest Reward" },
  { value: "deadline", label: "Deadline Soonest" },
  { value: "applicants", label: "Most Applicants" },
]

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState("newest")
  const [showFilters, setShowFilters] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [displayedTasks, setDisplayedTasks] = useState<any[]>([])
  const [marketplaceCategories, setMarketplaceCategories] = useState<Array<{ id: number; name: string; count: number }>>([])
  const [stats, setStats] = useState({ totalTasks: 0, featuredTasks: 0, totalReward: 0, matchingTasks: 0 })
  const { favoriteTasks, isFavorite, toggleFavorite, removeFavorite, isReady } = useFavoriteTasks()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        if (searchQuery) params.set("q", searchQuery)
        if (selectedCategory) params.set("category", selectedCategory)
        params.set("sort", sortBy)
        const res = await fetch(`/api/marketplace/tasks?${params.toString()}`, { method: "GET" })
        const data = await res.json().catch(() => null)
        if (cancelled) return
        setDisplayedTasks(Array.isArray(data?.tasks) ? data.tasks : [])
        if (Array.isArray(data?.categories)) setMarketplaceCategories(data.categories)
        if (data?.stats) setStats(data.stats)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [searchQuery, selectedCategory, sortBy])

  const featuredTasks = displayedTasks.filter((t) => t.featured)
  const visibleFavoriteTasks = favoriteTasks.filter((task) => {
    const matchesSearch =
      !searchQuery ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.skills.some((skill) => skill.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesCategory = !selectedCategory || task.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Marketplace</h1>
          <p className="text-muted-foreground mt-1">
            Find Bitcoin-funded tasks that match your skills
          </p>
        </div>

        {/* Search & Filters Bar */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks, skills, or keywords..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2 min-[420px]:flex-row sm:w-auto">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className={cn("justify-center", showFilters && "bg-accent")}
              >
                <Filter className="mr-2 h-4 w-4" />
                Filters
                {selectedCategory && (
                  <Badge variant="bitcoin" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                    1
                  </Badge>
                )}
              </Button>
              <label className="relative flex items-center">
                <ArrowUpDown className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm min-[420px]:min-w-[180px]"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-4">
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Total Tasks</p>
                <p className="text-xl font-semibold">{stats.totalTasks}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Matching</p>
                <p className="text-xl font-semibold">{stats.matchingTasks}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Featured</p>
                <p className="text-xl font-semibold">{stats.featuredTasks}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Total Reward</p>
                <p className="text-xl font-semibold font-mono">{formatSatoshis(stats.totalReward)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                !selectedCategory
                  ? "bg-bitcoin-500 text-white shadow-lg shadow-bitcoin-500/20"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              All
            </button>
            {marketplaceCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                  selectedCategory === cat.name
                    ? "bg-bitcoin-500 text-white shadow-lg shadow-bitcoin-500/20"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                {cat.name}
                <span className="ml-1.5 text-xs opacity-70">{cat.count}</span>
              </button>
            ))}
          </div>

          {/* Expandable Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <Card className="p-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Sort</h4>
                      <p className="text-sm text-muted-foreground">
                        Search, category filters, and sorting are loaded from marketplace tasks in the database.
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedCategory(null)
                          setSearchQuery("")
                        }}
                      >
                        Clear all filters
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Featured Tasks */}
        {featuredTasks.length > 0 && !searchQuery && !selectedCategory && (
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Star className="h-4 w-4 text-bitcoin-500 fill-bitcoin-500" />
              Featured Tasks
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredTasks.map((task, index) => (
                <TaskCard key={task.id} task={task} index={index} featured />
              ))}
            </div>
          </div>
        )}

        {isReady && (
          <div>
            <div className="flex items-center justify-between mb-4 gap-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                Saved Tasks ({visibleFavoriteTasks.length})
              </h2>
            </div>

            {visibleFavoriteTasks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleFavoriteTasks.map((task, index) => (
                  <TaskCard
                    key={`favorite-${task.id}`}
                    task={task}
                    index={index}
                    isSaved={isFavorite(task.id)}
                    onToggleSaved={() => removeFavorite(task.id)}
                  />
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Star a task to save it here for quick access later.
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* All Tasks */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {searchQuery || selectedCategory
                ? `Results (${displayedTasks.length})`
                : "All Tasks"}
            </h2>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <TaskCardSkeleton key={i} />
              ))}
            </div>
          ) : displayedTasks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedTasks.map((task, index) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={index}
                  isSaved={isFavorite(task.id)}
                  onToggleSaved={() => toggleFavorite(createFavoriteTask(task))}
                />
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Try adjusting your search or filters
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("")
                  setSelectedCategory(null)
                }}
              >
                Clear filters
              </Button>
            </Card>
          )}
        </div>
      </motion.div>
    </div>
  )
}

function TaskCard({
  task,
  index,
  featured = false,
  isSaved = false,
  onToggleSaved,
}: {
  task: any
  index: number
  featured?: boolean
  isSaved?: boolean
  onToggleSaved?: () => void
}) {
  const employerName = task?.employer?.displayName || "Employer"
  const employerAvatar = task?.employer?.avatar || ""
  const employerInitial = String(employerName || "E").trim().slice(0, 1).toUpperCase()
  const statusText = String(task?.status || "open").replaceAll("_", " ")

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card
        className={cn(
          "h-full group hover:border-bitcoin-500/30 transition-all duration-300",
          featured && "border-bitcoin-500/20 shadow-lg shadow-bitcoin-500/5"
        )}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {task.category}
              </Badge>
              {featured && (
                <Badge variant="bitcoin" className="text-[10px]">
                  <Star className="h-3 w-3 mr-1 fill-current" />
                  Featured
                </Badge>
              )}
            </div>
            <Button
              type="button"
              variant={isSaved ? "bitcoin" : "ghost"}
              size="icon-sm"
              className="shrink-0"
              aria-label={isSaved ? "Remove from saved tasks" : "Save task"}
              onClick={onToggleSaved}
            >
              <Star className={cn("h-4 w-4", isSaved && "fill-current")} />
            </Button>
          </div>

          <Link href={`/task/${task.id}` as Route} className="block">
            <h3 className="font-semibold text-sm mb-2 group-hover:text-bitcoin-500 transition-colors line-clamp-2">
              {task.title}
            </h3>
            <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
              {truncate(task.description, 120)}
            </p>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {task.skills.slice(0, 3).map((skill: string) => (
                <span
                  key={skill}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                >
                  {skill}
                </span>
              ))}
              {task.skills.length > 3 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  +{task.skills.length - 3}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border/40">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={employerAvatar} />
                  <AvatarFallback className="text-[10px]">{employerInitial}</AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">{employerName}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {task.applicants}/{task.maxApplicants}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {task.deadline ? timeAgo(task.deadline) : "No deadline"}
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bitcoin className="h-4 w-4 text-bitcoin-500" />
                <span className="font-mono font-semibold text-bitcoin-500">
                  {formatSatoshis(task.reward)}
                </span>
              </div>
              <Badge
                variant={String(task?.status || "") === "published" ? "success" : "warning"}
                className="text-[10px]"
              >
                {statusText}
              </Badge>
            </div>
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function TaskCardSkeleton() {
  return (
    <Card className="h-full">
      <CardContent className="p-5 space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex justify-between pt-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-16" />
        </div>
      </CardContent>
    </Card>
  )
}
