import { AlertTriangle } from "lucide-react"

export function DevelopmentBanner() {
  return (
    <div className="sticky top-0 z-[60] flex h-10 items-center justify-center border-b border-amber-500/30 bg-amber-500/10 px-3 text-amber-950 backdrop-blur dark:text-amber-100">
      <div className="flex min-w-0 items-center gap-2 text-xs font-medium sm:text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="truncate">
          This website is still in development. Some features may change while testing.
        </span>
      </div>
    </div>
  )
}
