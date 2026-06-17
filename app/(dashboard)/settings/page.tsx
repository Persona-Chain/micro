"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import {
  User,
  Shield,
  Wallet,
  Bell,
  Key,
  Camera,
  Save,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { copyText } from "@/lib/client/clipboard"

type ProfileState = {
  username: string
  displayName?: string | null
  bio?: string | null
  location?: string | null
  website?: string | null
  github?: string | null
  twitter?: string | null
  avatarUrl?: string | null
}

type UserState = {
  username: string
  email: string
}

type SettingsState = {
  emailNotifications: boolean
  pushNotifications: boolean
  taskUpdates: boolean
  paymentAlerts: boolean
  notificationSound: boolean
  marketing: boolean
  twoFactorEnabled: boolean
}

type ApiKeyItem = {
  id: number
  name?: string | null
  revoked: boolean
  createdAt: string
  lastUsedAt?: string | null
  keyMask: string
}

const defaultSettings: SettingsState = {
  emailNotifications: true,
  pushNotifications: true,
  taskUpdates: true,
  paymentAlerts: true,
  notificationSound: true,
  marketing: false,
  twoFactorEnabled: false,
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserState | null>(null)
  const [profile, setProfile] = useState<ProfileState | null>(null)
  const [settings, setSettings] = useState<SettingsState>(defaultSettings)
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([])
  const [newApiKeyName, setNewApiKeyName] = useState("")
  const [newApiKeyValue, setNewApiKeyValue] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [isSavingPrefs, setIsSavingPrefs] = useState(false)
  const [isCreatingKey, setIsCreatingKey] = useState(false)
  const [savedProfile, setSavedProfile] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [accountMessage, setAccountMessage] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const [authRes, profileRes, prefsRes, keysRes, walletRes] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          fetch("/api/profile/me", { cache: "no-store" }),
          fetch("/api/account/notification-preferences", { cache: "no-store" }),
          fetch("/api/account/api-keys", { cache: "no-store" }),
          fetch("/api/wallet", { cache: "no-store" }),
        ])

        if (authRes.ok) {
          const data = await authRes.json().catch(() => null)
          if (data?.user) setUser(data.user)
        }

        if (profileRes.ok) {
          const data = await profileRes.json().catch(() => null)
          if (data?.profile) setProfile(data.profile)
        }

        if (prefsRes.ok) {
          const data = await prefsRes.json().catch(() => null)
          if (data?.settings) setSettings(data.settings)
        }

        if (keysRes.ok) {
          const data = await keysRes.json().catch(() => null)
          if (data?.apiKeys) setApiKeys(data.apiKeys)
        }

        if (walletRes.ok) {
          const data = await walletRes.json().catch(() => null)
          if (data?.address) setWalletAddress(data.address)
        }
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [])

  const username = user?.username || profile?.username || ""
  const email = user?.email || ""

  async function handleProfileSave() {
    if (!profile) return
    setIsSavingProfile(true)
    setAccountMessage(null)
    try {
      const res = await fetch("/api/profile/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: profile.displayName,
          bio: profile.bio,
          location: profile.location,
          website: profile.website,
          github: profile.github,
          twitter: profile.twitter,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setAccountMessage(data?.message || "Unable to save profile")
        return
      }
      setProfile(data.profile)
      setSavedProfile(true)
      setTimeout(() => setSavedProfile(false), 3000)
    } catch (error) {
      setAccountMessage("Unable to save profile")
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function handlePasswordUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSavingPassword(true)
    setPasswordMessage(null)
    const form = new FormData(event.currentTarget)
    const currentPassword = String(form.get("currentPassword") || "")
    const newPassword = String(form.get("newPassword") || "")
    const confirmPassword = String(form.get("confirmPassword") || "")

    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setPasswordMessage(data?.message || "Unable to update password")
        return
      }
      setPasswordMessage("Password updated successfully")
      event.currentTarget.reset()
    } catch (error) {
      setPasswordMessage("Unable to update password")
    } finally {
      setIsSavingPassword(false)
    }
  }

  async function handleAvatarUpload(file: File) {
    setAccountMessage(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setAccountMessage(data?.message || "Unable to upload avatar")
        return
      }
      setProfile((prev) => (prev ? { ...prev, avatarUrl: data.avatarUrl } : prev))
      setAvatarPreview(URL.createObjectURL(file))
    } catch (error) {
      setAccountMessage("Unable to upload avatar")
    }
  }

  async function handleTogglePreference(key: keyof SettingsState) {
    const updated = { ...settings, [key]: !settings[key] }
    setSettings(updated)
    setIsSavingPrefs(true)
    try {
      const res = await fetch("/api/account/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: updated[key] }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setSettings(settings)
        setAccountMessage(data?.message || "Unable to update preferences")
        return
      }
      setSettings(data.settings)
    } catch (error) {
      setSettings(settings)
      setAccountMessage("Unable to update preferences")
    } finally {
      setIsSavingPrefs(false)
    }
  }

  async function handleCreateApiKey() {
    setIsCreatingKey(true)
    setAccountMessage(null)
    try {
      const res = await fetch("/api/account/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newApiKeyName || undefined }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setAccountMessage(data?.message || "Unable to create API key")
        return
      }
      if (data.apiKey) {
        setApiKeys((prev) => [data.apiKey, ...prev])
      }
      setNewApiKeyValue(data.key)
      setNewApiKeyName("")
    } catch (error) {
      setAccountMessage("Unable to create API key")
    } finally {
      setIsCreatingKey(false)
    }
  }

  function triggerFileInput() {
    fileInputRef.current?.click()
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) handleAvatarUpload(file)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto space-y-6"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account preferences and security settings.</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="w-full sm:w-auto flex-wrap h-auto">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="wallet" className="gap-2">
              <Wallet className="h-4 w-4" />
              Wallet
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="api" className="gap-2">
              <Key className="h-4 w-4" />
              API Keys
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your public profile and avatar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="relative">
                    <Avatar className="h-20 w-20">
                      {avatarPreview || profile?.avatarUrl ? (
                        <AvatarImage src={avatarPreview || profile?.avatarUrl || ""} />
                      ) : null}
                      <AvatarFallback className="text-2xl">
                        {profile?.displayName?.[0] || user?.username?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      type="button"
                      onClick={triggerFileInput}
                      className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-bitcoin-500 text-white hover:bg-bitcoin-600"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                  </div>
                  <div>
                    <p className="font-medium">Profile Picture</p>
                    <p className="text-sm text-muted-foreground">Upload JPG, PNG, or WEBP. Max 5MB.</p>
                  </div>
                </div>

                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileChange} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      value={profile?.displayName ?? ""}
                      onChange={(event) =>
                        setProfile((prev) => (prev ? { ...prev, displayName: event.target.value } : prev))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" value={username} disabled />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={email} disabled />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <textarea
                    id="bio"
                    value={profile?.bio ?? ""}
                    onChange={(event) => setProfile((prev) => (prev ? { ...prev, bio: event.target.value } : prev))}
                    className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={profile?.location ?? ""}
                      onChange={(event) => setProfile((prev) => (prev ? { ...prev, location: event.target.value } : prev))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={profile?.website ?? ""}
                      onChange={(event) => setProfile((prev) => (prev ? { ...prev, website: event.target.value } : prev))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="github">GitHub</Label>
                    <Input
                      id="github"
                      value={profile?.github ?? ""}
                      onChange={(event) => setProfile((prev) => (prev ? { ...prev, github: event.target.value } : prev))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twitter">Twitter</Label>
                    <Input
                      id="twitter"
                      value={profile?.twitter ?? ""}
                      onChange={(event) => setProfile((prev) => (prev ? { ...prev, twitter: event.target.value } : prev))}
                    />
                  </div>
                </div>

                {accountMessage && <p className="text-sm text-destructive">{accountMessage}</p>}

                <div className="flex justify-end">
                  <Button
                    onClick={handleProfileSave}
                    disabled={isSavingProfile || !profile}
                    className="bg-bitcoin-500 hover:bg-bitcoin-600 text-white"
                  >
                    {isSavingProfile ? (
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : savedProfile ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>Update your password and secure your account.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handlePasswordUpdate}>
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        name="currentPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter current password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input id="newPassword" name="newPassword" type="password" placeholder="Enter new password" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="Confirm new password" />
                  </div>

                  {passwordMessage && <p className="text-sm text-muted-foreground">{passwordMessage}</p>}

                  <Button type="submit" className="bg-bitcoin-500 hover:bg-bitcoin-600 text-white" disabled={isSavingPassword}>
                    {isSavingPassword ? (
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "Update Password"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Two-Factor Authentication</CardTitle>
                <CardDescription>Add an extra layer of security to your account.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between p-4 rounded-lg border border-border/40">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bitcoin-500/10">
                      <Shield className="h-5 w-5 text-bitcoin-500" />
                    </div>
                    <div>
                      <p className="font-medium">Authenticator App</p>
                      <p className="text-sm text-muted-foreground">
                        {settings.twoFactorEnabled ? "Two-factor authentication is enabled." : "Enable 2FA for additional security."}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleTogglePreference("twoFactorEnabled")}
                    disabled={isSavingPrefs}
                  >
                    {settings.twoFactorEnabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wallet" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Wallet Settings</CardTitle>
                <CardDescription>Manage your Bitcoin wallet details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>BSV On-Chain Address</Label>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                      <code className="text-sm font-mono flex-1 truncate">{walletAddress || "-"}</code>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => copyText(walletAddress)}
                        disabled={!walletAddress}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose which alerts you receive across the app.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(
                  [
                    { key: "emailNotifications", label: "Email Notifications", desc: "Receive account updates by email." },
                    { key: "pushNotifications", label: "Push Notifications", desc: "Receive browser and app alerts." },
                    { key: "taskUpdates", label: "Task Updates", desc: "Get notified about task status changes." },
                    { key: "paymentAlerts", label: "Payment Alerts", desc: "Receive alerts for deposits and payouts." },
                    { key: "notificationSound", label: "Notification Sound", desc: "Play a sound when a new notification arrives." },
                    { key: "marketing", label: "Marketing", desc: "Receive news and product updates." },
                  ] as const
                ).map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border/40 p-4 hover:border-bitcoin-500 transition"
                  >
                    <div>
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings[item.key]}
                      onChange={() => handleTogglePreference(item.key)}
                      className="h-5 w-5 rounded border border-border text-bitcoin-500 focus:ring-ring"
                    />
                  </label>
                ))}
                {accountMessage && <p className="text-sm text-destructive">{accountMessage}</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Generate keys for external integrations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {newApiKeyValue ? (
                  <div className="space-y-3 rounded-lg border border-border/40 bg-muted p-4">
                    <p className="text-sm font-medium">New API key created</p>
                    <p className="text-xs text-muted-foreground">Save this key now. It is shown only once.</p>
                    <div className="flex items-center gap-2 rounded-lg bg-background p-3 text-sm font-mono">
                      <span className="truncate">{newApiKeyValue}</span>
                      <Button variant="ghost" size="icon-sm" onClick={() => copyText(newApiKeyValue)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="apiKeyName">Key Name</Label>
                    <Input
                      id="apiKeyName"
                      value={newApiKeyName}
                      placeholder="e.g. project-integration"
                      onChange={(event) => setNewApiKeyName(event.target.value)}
                    />
                  </div>
                  <Button
                    className="h-fit bg-bitcoin-500 hover:bg-bitcoin-600 text-white"
                    onClick={handleCreateApiKey}
                    disabled={isCreatingKey}
                  >
                    {isCreatingKey ? (
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Key className="mr-2 h-4 w-4" />
                        Generate Key
                      </>
                    )}
                  </Button>
                </div>

                <div className="space-y-3">
                  {apiKeys.length === 0 ? (
                    <div className="rounded-lg border border-border/40 bg-muted p-4 text-sm text-muted-foreground">
                      No API keys created yet.
                    </div>
                  ) : (
                    apiKeys.map((item) => (
                      <div key={item.id} className="rounded-lg border border-border/40 bg-background p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium">{item.name || `Key ${item.id}`}</p>
                            <p className="text-xs text-muted-foreground">Created {new Date(item.createdAt).toLocaleDateString()}</p>
                          </div>
                          <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-500">
                            {item.revoked ? "Revoked" : "Active"}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-4 rounded-lg border border-border/40 bg-muted px-3 py-2 text-sm font-mono">
                          <span className="truncate">{item.keyMask}</span>
                          <Button variant="ghost" size="icon-sm" onClick={() => copyText(item.keyMask)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {accountMessage && <p className="text-sm text-destructive">{accountMessage}</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  )
}
