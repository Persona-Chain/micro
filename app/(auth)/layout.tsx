import Link from "next/link"
import { HoneyPotLogo } from "@/components/brand/honey-pot-logo"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-bitcoin-950/20 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center space-y-2">
          <Link href="/" className="flex items-center gap-2 group">
            <HoneyPotLogo className="h-12 w-12 rounded-xl transition-shadow duration-300 group-hover:shadow-bitcoin-500/40" iconClassName="h-8 w-8" />
            <span className="text-2xl font-bold tracking-tight">
              Bounty<span className="text-bitcoin-500">Bee</span>
            </span>
          </Link>
          <p className="text-sm text-muted-foreground">
            The Bitcoin-powered micro-freelancing platform
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
