import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { ThemeProvider } from "@/components/layout/theme-provider"
import { DevelopmentBanner } from "@/components/layout/development-banner"

export const metadata: Metadata = {
  title: "Bountybee - Earn Bitcoin by Completing Tasks",
  description: "The premier Bitcoin-powered micro-freelancing platform. Complete tasks, get paid in BitcoinSV instantly .",
  keywords: ["bitcoin", "freelancing", "microtasks", "BSV", "crypto", "remote work"],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <DevelopmentBanner />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
