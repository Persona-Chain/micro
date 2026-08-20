import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { ThemeProvider } from "@/components/layout/theme-provider"
import { DevelopmentBanner } from "@/components/layout/development-banner"

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:38473"),
  title: "Bountybee - Earn Bitcoin by Completing Tasks",
  description: "The premier Bitcoin-powered micro-freelancing platform. Complete tasks, get paid in BitcoinSV instantly .",
  keywords: ["bitcoin", "freelancing", "microtasks", "BSV", "crypto", "remote work"],
  openGraph: {
    type: "website",
    siteName: "Bountybee",
    title: "Bountybee - Earn Bitcoin by Completing Tasks",
    description: "Complete freelance tasks and get paid in BitcoinSV.",
    images: [
      {
        url: "/social-preview.svg",
        width: 1200,
        height: 630,
        alt: "Bountybee - Bitcoin-powered micro-freelancing",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    creator: "@SatoshiSwords",
    site: "@SatoshiSwords",
    title: "Bountybee - Earn Bitcoin by Completing Tasks",
    description: "Complete freelance tasks and get paid in BitcoinSV.",
    images: ["/social-preview.svg"],
  },
  icons: {
    icon: "/logo.webp",
    shortcut: "/logo.webp",
    apple: "/logo.webp",
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
