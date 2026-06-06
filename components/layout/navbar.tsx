"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import type { Route } from "next"
import {
  Menu,
  X,
  Zap,
  Bell,
  MessageSquare,
  Wallet,
  Search,
  ChevronDown,
  Sun,
  Moon,
  LogOut,
  Settings,
  User,
  CheckCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { HoneyPotLogo } from "@/components/brand/honey-pot-logo"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import { formatSatoshis } from "@/lib/utils"

const navLinks: { href: Route; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: Zap },
  { href: "/marketplace", label: "Marketplace", icon: Search },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/wallet", label: "Wallet", icon: Wallet },
]

type NotificationItem = {
  id: number
  type: string
  message: string
  link?: string | null
  read: boolean
  createdAt: string
}

type NavbarUser = {
  username: string
  email: string
  displayName: string
  avatarUrl?: string | null
  availableBalance: number
  pendingBalance: number
}

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notifs, setNotifs] = useState<NotificationItem[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(true)
  const [markingRead, setMarkingRead] = useState(false)
  const [navbarUser, setNavbarUser] = useState<NavbarUser | null>(null)
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(true)
  const seenNotificationIdsRef = useRef<Set<number>>(new Set())
  const notificationsInitializedRef = useRef(false)
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const unreadCount = notifs.filter((n) => !n.read).length
  const displayName = navbarUser?.displayName || navbarUser?.username || "Account"
  const username = navbarUser?.username || "user"
  const avatarInitial = displayName.slice(0, 1).toUpperCase() || "U"

  useEffect(() => {
    function playNotificationSound() {
      if (!notificationSoundEnabled) return
      try {
        const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioContextCtor) return
        const ctx = new AudioContextCtor()
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()
        oscillator.type = "sine"
        oscillator.frequency.setValueAtTime(880, ctx.currentTime)
        gain.gain.setValueAtTime(0.0001, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18)
        oscillator.connect(gain)
        gain.connect(ctx.destination)
        oscillator.start()
        oscillator.stop(ctx.currentTime + 0.2)
      } catch {
        // Browsers can block audio until the user has interacted with the page.
      }
    }

    async function loadNotifications() {
      try {
        const res = await fetch("/api/dashboard/notifications", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        const next = Array.isArray(data) ? data : []
        const previousIds = seenNotificationIdsRef.current
        const hasNewUnread =
          notificationsInitializedRef.current &&
          next.some((notif: NotificationItem) => !notif.read && !previousIds.has(notif.id))
        seenNotificationIdsRef.current = new Set(next.map((notif: NotificationItem) => notif.id))
        notificationsInitializedRef.current = true
        setNotifs(next)
        if (hasNewUnread) playNotificationSound()
      } catch {
        // ignore load errors for header badge
      } finally {
        setLoadingNotifications(false)
      }
    }

    loadNotifications()
    const interval = window.setInterval(loadNotifications, 8000)
    return () => window.clearInterval(interval)
  }, [notificationSoundEnabled])

  useEffect(() => {
    async function loadNavbarUser() {
      try {
        const [authRes, profileRes, balanceRes, prefsRes] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          fetch("/api/profile/me", { cache: "no-store" }),
          fetch("/api/wallet/balance", { cache: "no-store" }),
          fetch("/api/account/notification-preferences", { cache: "no-store" }),
        ])

        if (!authRes.ok) return
        const [authData, profileData, balanceData, prefsData] = await Promise.all([
          authRes.json().catch(() => null),
          profileRes.ok ? profileRes.json().catch(() => null) : Promise.resolve(null),
          balanceRes.ok ? balanceRes.json().catch(() => null) : Promise.resolve(null),
          prefsRes.ok ? prefsRes.json().catch(() => null) : Promise.resolve(null),
        ])

        const user = authData?.user
        if (!user?.username) return

        setNavbarUser({
          username: user.username,
          email: user.email || "",
          displayName: profileData?.profile?.displayName || user.username,
          avatarUrl: profileData?.profile?.avatarUrl || null,
          availableBalance: Number(balanceData?.availableBalance || 0),
          pendingBalance: Number(balanceData?.pendingBalance || 0),
        })
        setNotificationSoundEnabled(prefsData?.settings?.notificationSound !== false)
      } catch {
        // keep header usable if account summary fails
      }
    }

    loadNavbarUser()
  }, [])

  async function markAllNotificationsRead() {
    if (unreadCount === 0 || markingRead) return
    setMarkingRead(true)
    try {
      const res = await fetch("/api/dashboard/notifications", { method: "PATCH" })
      if (!res.ok) return
      setNotifs((items) => items.map((item) => ({ ...item, read: true })))
    } finally {
      setMarkingRead(false)
    }
  }

  return (
    <header className="sticky top-10 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <HoneyPotLogo className="h-9 w-9 transition-shadow duration-300 group-hover:shadow-bitcoin-500/40" iconClassName="h-6 w-6" />
          <span className="text-xl font-bold tracking-tight">
            Bounty<span className="text-bitcoin-500">Bee</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname?.startsWith(link.href + "/")
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative px-3 py-2 text-sm font-medium transition-colors rounded-md",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="navbar-active"
                    className="absolute inset-0 rounded-md bg-accent"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="hidden sm:flex"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <Badge
                    variant="bitcoin"
                    className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[calc(100vw-1rem)] max-w-80">
              <DropdownMenuLabel className="flex items-center justify-between gap-2">
                <span>Notifications</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={markAllNotificationsRead}
                  disabled={unreadCount === 0 || markingRead}
                  title="Mark all notifications as read"
                >
                  <CheckCheck className="h-4 w-4" />
                </Button>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifs.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  {loadingNotifications ? "Loading notifications..." : "No notifications"}
                </div>
              ) : (
                notifs.slice(0, 5).map((notif) => {
                  const title =
                    notif.type === "payment"
                      ? "Payment update"
                      : notif.type === "task"
                      ? "Task update"
                      : notif.type === "escrow"
                      ? "Escrow update"
                      : "Notification"

                  return (
                    <DropdownMenuItem key={notif.id} asChild={Boolean(notif.link)}>
                      {notif.link ? (
                        <Link href={notif.link as Route} className="flex flex-col items-start gap-1 p-3 cursor-pointer">
                          <div className="flex items-center gap-2 w-full">
                            <span className={cn("h-2 w-2 rounded-full", notif.read ? "bg-muted" : "bg-bitcoin-500")} />
                            <span className="font-medium text-sm">{title}</span>
                          </div>
                          <span className="text-xs text-muted-foreground pl-4">{notif.message}</span>
                        </Link>
                      ) : (
                        <div className="flex flex-col items-start gap-1 p-3 cursor-pointer">
                          <div className="flex items-center gap-2 w-full">
                            <span className={cn("h-2 w-2 rounded-full", notif.read ? "bg-muted" : "bg-bitcoin-500")} />
                            <span className="font-medium text-sm">{title}</span>
                          </div>
                          <span className="text-xs text-muted-foreground pl-4">{notif.message}</span>
                        </div>
                      )}
                    </DropdownMenuItem>
                  )
                })
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/notifications" className="w-full justify-center text-bitcoin-500">
                  View all notifications
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  {navbarUser?.avatarUrl ? <AvatarImage src={navbarUser.avatarUrl} alt={displayName} /> : null}
                  <AvatarFallback>{avatarInitial}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground">@{username}</p>
                  {navbarUser?.email ? <p className="text-xs text-muted-foreground">{navbarUser.email}</p> : null}
                  <p className="text-xs text-bitcoin-500 font-mono">
                    {formatSatoshis(navbarUser?.availableBalance ?? 0)} available
                  </p>
                  {(navbarUser?.pendingBalance ?? 0) > 0 ? (
                    <p className="text-xs text-amber-500 font-mono">
                      {formatSatoshis(navbarUser?.pendingBalance ?? 0)} pending
                    </p>
                  ) : null}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/profile/${username}` as Route} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/wallet" className="cursor-pointer">
                  <Wallet className="mr-2 h-4 w-4" />
                  Wallet
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive cursor-pointer"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" })
                  window.location.href = "/login"
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-xl"
          >
            <nav className="container py-4 flex flex-col gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    )}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                )
              })}
              <div className="mt-2 pt-2 border-t border-border/40">
                <div className="flex items-center gap-3 px-3 py-2">
                  <Avatar className="h-8 w-8">
                    {navbarUser?.avatarUrl ? <AvatarImage src={navbarUser.avatarUrl} /> : null}
                    <AvatarFallback>{avatarInitial}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{displayName}</span>
                    <span className="text-xs text-muted-foreground">@{username}</span>
                    <span className="text-xs text-bitcoin-500 font-mono">
                      {formatSatoshis(navbarUser?.availableBalance ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
