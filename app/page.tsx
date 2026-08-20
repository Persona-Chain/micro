"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import {
  Zap,
  ArrowRight,
  Shield,
  Clock,
  Globe,
  Bitcoin,
  CheckCircle2,
  ChevronDown,
  Play,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Footer } from "@/components/layout/footer"
import { HoneyPotLogo } from "@/components/brand/honey-pot-logo"
import { faqs } from "@/data/sample-data"
import { formatSatoshis } from "@/lib/utils"
import { useEffect, useState } from "react"

type PlatformStats = {
  totalUsers: number
  totalTasks: number
  totalEarned: number
  avgRating: number
}

const features = [
  {
    icon: Bitcoin,
    title: "Instant Bitcoin Payments",
    description: "Get paid instantly via BSV Network. No waiting, no intermediaries, just pure Bitcoin.",
  },
  {
    icon: Shield,
    title: "Secure Escrow System",
    description: "Multi-signature escrow protects both freelancers and employers. Funds are only released when work is approved.",
  },
  {
    icon: Clock,
    title: "Fast Turnaround",
    description: "Micro-tasks are designed to be completed quickly. Most tasks take hours, not weeks.",
  },
  {
    icon: Globe,
    title: "Global Marketplace",
    description: "Work with talent from around the world. Bitcoin knows no borders.",
  },
  {
    icon: Zap,
    title: "Low Fees",
    description: "Only 5% platform fee. Compare that to 20%+ on traditional platforms. Keep more of what you earn.",
  },
  {
    icon: CheckCircle2,
    title: "Verified Reputation",
    description: "Build your reputation with every completed task. Higher scores unlock premium opportunities.",
  },
]

const steps = [
  {
    number: "01",
    title: "Browse Tasks",
    description: "Explore hundreds of Bitcoin-funded micro-tasks across development, design, writing, and more.",
  },
  {
    number: "02",
    title: "Apply & Complete",
    description: "Apply to tasks that match your skills. Complete the work and submit for review.",
  },
  {
    number: "03",
    title: "Get Paid in Bitcoin",
    description: "Once approved, payment is sent instantly via BSV Network to your wallet.",
  },
]

function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="tabular-nums"
    >
      {value.toLocaleString()}{suffix}
    </motion.span>
  )
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<string | null>(null)
  const [platformStats, setPlatformStats] = useState<PlatformStats>({
    totalUsers: 0,
    totalTasks: 0,
    totalEarned: 0,
    avgRating: 0,
  })

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch("/api/platform/stats", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json().catch(() => null)
        if (cancelled) return
        setPlatformStats({
          totalUsers: Number(data?.totalUsers || 0),
          totalTasks: Number(data?.totalTasks || 0),
          totalEarned: Number(data?.totalEarned || 0),
          avgRating: Number(data?.avgRating || 0),
        })
      } catch {
        // Keep zero stats if public stats fail.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="fixed top-10 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <HoneyPotLogo className="h-9 w-9" iconClassName="h-6 w-6" />
            <span className="text-xl font-bold tracking-tight">
              Bounty<span className="text-bitcoin-500">Bee</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-bitcoin-500 hover:bg-bitcoin-600 text-white">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        className="relative isolate overflow-hidden bg-cover bg-center bg-no-repeat pt-32 pb-20 lg:pt-44 lg:pb-28"
        style={{ backgroundImage: "url('/background.webp')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-black/35" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />

        <div className="container relative z-10">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
            <div className="max-w-2xl text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge variant="bitcoin" className="mb-6 px-4 py-1.5 text-sm">
                <Bitcoin className="h-3 w-3 mr-1" />
                Now on Bitcoin SV
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight mb-6"
            >
              Earn{" "}
              <span className="text-gradient">Bitcoin</span>
              <br />
              by Completing Tasks.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 mb-10"
            >
              The premier micro-freelancing platform powered by Bitcoin SV. 
              Complete tasks, build your reputation, and get paid instantly.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
            >
              <Link href="/marketplace">
                <Button size="lg" className="bg-bitcoin-500 hover:bg-bitcoin-600 text-white shadow-lg shadow-bitcoin-500/25 text-base px-8">
                  Start Earning
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/create-task">
                <Button size="lg" variant="outline" className="text-base px-8 border-bitcoin-500/30 hover:bg-bitcoin-500/10">
                  Post a Task
                </Button>
              </Link>
            </motion.div>

            {/* Stats Bar */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-16 grid grid-cols-1 gap-6 rounded-2xl p-6 glass min-[420px]:grid-cols-2 md:grid-cols-4"
            >
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-bitcoin-500">
                  <AnimatedCounter value={platformStats.totalUsers} />
                </div>
                <div className="text-sm text-muted-foreground mt-1">Active Users</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-bitcoin-500">
                  <AnimatedCounter value={platformStats.totalTasks} />
                </div>
                <div className="text-sm text-muted-foreground mt-1">Tasks Posted</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-bitcoin-500">
                  {formatSatoshis(platformStats.totalEarned)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Total Earned</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-bitcoin-500">
                  <AnimatedCounter value={platformStats.avgRating} suffix="/5" />
                </div>
                <div className="text-sm text-muted-foreground mt-1">Avg. Rating</div>
              </div>
            </motion.div>
          </div>
            <div className="relative hidden h-[520px] w-full max-w-[540px] justify-self-end lg:block" aria-hidden="true">
              <Image
                src="/logo.webp"
                alt=""
                fill
                priority
                sizes="(min-width: 1024px) 540px, 0px"
                className="object-contain drop-shadow-[0_0_30px_rgba(247,147,26,0.22)]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="scroll-mt-24 py-20 lg:py-32">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="bitcoin" className="mb-4">Features</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Everything you need to earn Bitcoin
            </h2>
            <p className="text-muted-foreground text-lg">
              A complete platform designed for the Bitcoin economy. Fast, secure, and built for freelancers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="h-full group hover:border-bitcoin-500/30 transition-all duration-300">
                  <CardContent className="p-6 text-center md:text-left">
                    <div className="h-12 w-12 rounded-xl bg-bitcoin-500/10 flex items-center justify-center mb-4 mx-auto md:mx-0 group-hover:bg-bitcoin-500/20 transition-colors">
                      <feature.icon className="h-6 w-6 text-bitcoin-500" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="scroll-mt-24 py-20 lg:py-32 bg-muted/30">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="bitcoin" className="mb-4">How It Works</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Three steps to Bitcoin earnings
            </h2>
            <p className="text-muted-foreground text-lg">
              Getting started is simple. Complete tasks and get paid in minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className="relative text-center md:text-left"
              >
                <div className="text-6xl font-bold text-bitcoin-500/10 mb-4">{step.number}</div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 right-0 translate-x-1/2">
                    <ArrowRight className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="scroll-mt-24 py-20 lg:py-32 bg-muted/30">
        <div className="container max-w-3xl">
          <div className="text-center mb-16">
            <Badge variant="bitcoin" className="mb-4">FAQ</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-muted-foreground text-lg">
              Everything you need to know about Bountybee.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq) => (
              <motion.div
                key={faq.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <Card
                  className="cursor-pointer transition-all duration-200 hover:border-bitcoin-500/20"
                  onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm sm:text-base pr-4">{faq.question}</h3>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                          openFaq === faq.id ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                    {openFaq === faq.id && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="text-sm text-muted-foreground mt-3 pt-3 border-t border-border/40"
                      >
                        {faq.answer}
                      </motion.p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-bitcoin-500/20 via-bitcoin-600/10 to-background border border-bitcoin-500/20 p-8 sm:p-16 text-center"
          >
            <div className="absolute inset-0 bg-bitcoin-500/5" />
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Ready to start earning Bitcoin?
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
                Join the future of work. Create your account in seconds and start completing tasks today.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/register">
                  <Button size="lg" className="bg-bitcoin-500 hover:bg-bitcoin-600 text-white shadow-lg shadow-bitcoin-500/25 text-base px-8">
                    Create Free Account
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/marketplace">
                  <Button size="lg" variant="outline" className="text-base px-8">
                    Browse Tasks
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
