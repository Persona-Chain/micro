import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground">The page you’re looking for doesn’t exist.</p>
        <div className="flex justify-center">
          <Link href="/">
            <Button className="bg-bitcoin-500 hover:bg-bitcoin-600 text-white">Go home</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

