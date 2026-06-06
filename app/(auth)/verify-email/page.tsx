"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function VerifyEmailPageInner() {
  const searchParams = useSearchParams()
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams])

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState<string>("")

  useEffect(() => {
    if (!token) return
    let cancelled = false

    async function run() {
      setStatus("loading")
      setMessage("")
      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
          method: "GET",
        })
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok) {
          setStatus("error")
          setMessage(data?.message || "Verification failed")
          return
        }
        setStatus("success")
        setMessage(data?.message || "Email verified")
      } catch {
        if (cancelled) return
        setStatus("error")
        setMessage("Verification failed. Please try again.")
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [token])

  const title =
    status === "success" ? "Email verified!" : status === "error" ? "Verification failed" : "Verify your email"

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="border-border/40 shadow-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">{title}</CardTitle>
          <CardDescription className="text-center">
            {token ? "We’re verifying your token…" : "Open the verification link you received after registering."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying…
            </div>
          )}

          {status === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6 py-2"
            >
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <p className="text-sm text-muted-foreground">{message || "Your email has been verified."}</p>
              <Link href="/login">
                <Button className="w-full bg-bitcoin-500 hover:bg-bitcoin-600 text-white">
                  Sign in
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          )}

          {status === "error" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6 py-2"
            >
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <p className="text-sm text-muted-foreground">{message || "Invalid or expired token."}</p>
              <Link href="/register">
                <Button variant="outline" className="w-full">
                  Create a new account
                </Button>
              </Link>
            </motion.div>
          )}

          {status === "idle" && (
            <p className="text-xs text-muted-foreground text-center">
              Email verification is currently skipped. You can sign in right away.
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPageInner />
    </Suspense>
  )
}
