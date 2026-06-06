"use client"

import { useCallback, useEffect, useState } from "react"

export type AuthUser = {
  id: number
  username: string
  email: string
  emailVerified: boolean
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/auth/me", { method: "GET" })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setUser(null)
        return
      }
      setUser(data?.user ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setUser(null)
  }, [])

  return { user, loading, refresh, logout }
}

