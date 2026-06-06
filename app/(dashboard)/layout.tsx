import { Navbar } from "@/components/layout/navbar"
import { Sidebar } from "@/components/layout/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex min-w-0">
        <Sidebar />
        <main className="min-w-0 flex-1 min-h-[calc(100dvh-4rem)] overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
