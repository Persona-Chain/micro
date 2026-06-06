"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Search,
  BookOpen,
  MessageCircle,
  Ticket,
  ChevronDown,
  ExternalLink,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Shield,
  Bitcoin,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { faqs } from "@/data/sample-data"
import { cn } from "@/lib/utils"

const categories = [
  { id: "getting-started", name: "Getting Started", icon: Zap, count: 8 },
  { id: "payments", name: "Payments", icon: Bitcoin, count: 12 },
  { id: "escrow", name: "Escrow", icon: Shield, count: 6 },
  { id: "account", name: "Account", icon: FileText, count: 10 },
  { id: "disputes", name: "Disputes", icon: AlertCircle, count: 4 },
]

const articles = [
  { id: "1", title: "How to create your first task", category: "Getting Started", readTime: "3 min", views: 2340 },
  { id: "2", title: "Understanding BSV payments", category: "Payments", readTime: "5 min", views: 1890 },
  { id: "3", title: "Escrow protection explained", category: "Escrow", readTime: "4 min", views: 1560 },
  { id: "4", title: "Building your reputation score", category: "Account", readTime: "3 min", views: 1230 },
  { id: "5", title: "Withdrawing Bitcoin to your wallet", category: "Payments", readTime: "2 min", views: 2100 },
  { id: "6", title: "How disputes are resolved", category: "Disputes", readTime: "6 min", views: 890 },
]

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [openFaq, setOpenFaq] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("knowledge-base")

  const filteredFaqs = faqs.filter(
    (f) =>
      f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.answer.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-bitcoin-500/10 mb-4">
            <BookOpen className="h-8 w-8 text-bitcoin-500" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Help Center</h1>
          <p className="text-muted-foreground mt-1">Find answers and get support</p>
        </div>

        {/* Search */}
        <div className="relative max-w-xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for help articles, FAQs..."
            className="pl-10 h-12"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full sm:w-auto flex-wrap h-auto">
            <TabsTrigger value="knowledge-base" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Knowledge Base
            </TabsTrigger>
            <TabsTrigger value="faq" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              FAQ
            </TabsTrigger>
            <TabsTrigger value="contact" className="gap-2">
              <Mail className="h-4 w-4" />
              Contact Support
            </TabsTrigger>
            <TabsTrigger value="tickets" className="gap-2">
              <Ticket className="h-4 w-4" />
              My Tickets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="knowledge-base" className="space-y-6">
            {/* Categories */}
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {categories.map((cat) => (
                <Card key={cat.id} className="hover:border-bitcoin-500/30 transition-all cursor-pointer">
                  <CardContent className="p-4 text-center">
                    <cat.icon className="h-8 w-8 text-bitcoin-500 mx-auto mb-2" />
                    <p className="font-medium text-sm">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">{cat.count} articles</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Popular Articles */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Popular Articles</h2>
              <div className="space-y-2">
                {articles.map((article) => (
                  <Card key={article.id} className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-sm">{article.title}</h3>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-[10px]">{article.category}</Badge>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {article.readTime}
                            </span>
                            <span>{article.views.toLocaleString()} views</span>
                          </div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="faq" className="space-y-4">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((faq) => (
                <Card
                  key={faq.id}
                  className="cursor-pointer transition-all duration-200 hover:border-bitcoin-500/20"
                  onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-[10px]">{faq.category}</Badge>
                        <h3 className="font-medium text-sm">{faq.question}</h3>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
                          openFaq === faq.id && "rotate-180"
                        )}
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
              ))
            ) : (
              <Card className="p-12 text-center">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No FAQs found matching your search</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="contact" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-bitcoin-500" />
                    Email Support
                  </CardTitle>
                  <CardDescription>Get a response within 24 hours</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input placeholder="What is your issue about?" />
                  </div>
                  <div className="space-y-2">
                    <Label>Message</Label>
                    <textarea
                      placeholder="Describe your issue in detail..."
                      className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                  <Button className="w-full bg-bitcoin-500 hover:bg-bitcoin-600 text-white">
                    Submit Ticket
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-bitcoin-500" />
                    Live Chat
                  </CardTitle>
                  <CardDescription>Chat with our support team</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                      <p className="font-medium text-sm">Support Online</p>
                      <p className="text-xs text-muted-foreground">Average response time: 2 minutes</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Start Live Chat
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tickets" className="space-y-4">
            <Card className="p-12 text-center">
              <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No tickets yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Submit a ticket and track its status here
              </p>
              <Button
                variant="outline"
                onClick={() => setActiveTab("contact")}
              >
                Create Ticket
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  )
}
