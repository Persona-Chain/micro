"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Shield,
  CheckCircle2,
  AlertCircle,
  Clock,
  Bitcoin,
  ArrowRight,
  User,
  FileText,
  MessageSquare,
  Lock,
  Unlock,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { escrows, tasks } from "@/data/sample-data"
import { formatSatoshis, timeAgo } from "@/lib/utils"
import { cn } from "@/lib/utils"

const statusConfig = {
  funded: { color: "bg-emerald-500/10 text-emerald-500", icon: Lock, label: "Funded" },
  released: { color: "bg-blue-500/10 text-blue-500", icon: Unlock, label: "Released" },
  disputed: { color: "bg-red-500/10 text-red-500", icon: AlertCircle, label: "Disputed" },
  refunded: { color: "bg-amber-500/10 text-amber-500", icon: RefreshCw, label: "Refunded" },
}

export default function EscrowPage() {
  const [activeTab, setActiveTab] = useState("active")
  const [releasing, setReleasing] = useState<string | null>(null)

  async function handleRelease(escrowId: string) {
    setReleasing(escrowId)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setReleasing(null)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Escrow</h1>
          <p className="text-muted-foreground mt-1">Manage your escrowed funds and milestones</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Shield className="h-5 w-5 text-bitcoin-500 mx-auto mb-1" />
              <span className="text-2xl font-bold">{escrows.length}</span>
              <p className="text-xs text-muted-foreground">Active Escrows</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Bitcoin className="h-5 w-5 text-bitcoin-500 mx-auto mb-1" />
              <span className="text-2xl font-bold font-mono">{formatSatoshis(escrows.reduce((a, b) => a + b.amount, 0))}</span>
              <p className="text-xs text-muted-foreground">Total Locked</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
              <span className="text-2xl font-bold">0</span>
              <p className="text-xs text-muted-foreground">Released</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <AlertCircle className="h-5 w-5 text-red-500 mx-auto mb-1" />
              <span className="text-2xl font-bold">0</span>
              <p className="text-xs text-muted-foreground">Disputes</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="disputes">Disputes</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4 mt-6">
            {escrows.map((escrow) => {
              const task = tasks.find((t) => t.id === escrow.taskId)
              const status = statusConfig[escrow.status]
              const StatusIcon = status.icon
              const completedMilestones = escrow.milestones.filter((m) => m.status === "completed").length
              const totalMilestones = escrow.milestones.length
              const progress = (completedMilestones / totalMilestones) * 100

              return (
                <Card key={escrow.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={cn("text-xs", status.color)}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {status.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Funded {timeAgo(escrow.fundedAt)}
                            </span>
                          </div>
                          <h3 className="font-semibold">{task?.title}</h3>
                          <p className="text-sm text-muted-foreground">Escrow ID: {escrow.id}</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-2xl font-bold font-mono text-bitcoin-500">
                            {formatSatoshis(escrow.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">Total Amount</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Progress</span>
                            <span className="text-sm text-muted-foreground">
                              {completedMilestones}/{totalMilestones} milestones
                            </span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>

                        <div className="space-y-2">
                          {escrow.milestones.map((milestone) => (
                            <div
                              key={milestone.id}
                              className="flex items-center justify-between p-3 rounded-lg border border-border/40"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    "h-8 w-8 rounded-full flex items-center justify-center",
                                    milestone.status === "completed"
                                      ? "bg-emerald-500/10"
                                      : "bg-muted"
                                  )}
                                >
                                  {milestone.status === "completed" ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                  ) : (
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{milestone.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatSatoshis(milestone.amount)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={milestone.status === "completed" ? "success" : "outline"}
                                  className="text-[10px]"
                                >
                                  {milestone.status}
                                </Badge>
                                {milestone.status === "completed" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRelease(milestone.id)}
                                    disabled={releasing === milestone.id}
                                  >
                                    {releasing === milestone.id ? (
                                      <div className="h-3 w-3 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                                    ) : (
                                      <>
                                        Release
                                        <ArrowRight className="ml-1 h-3 w-3" />
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 p-4 bg-muted/30 border-t border-border/40">
                      <Button variant="outline" size="sm">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Message
                      </Button>
                      <Button variant="outline" size="sm">
                        <FileText className="mr-2 h-4 w-4" />
                        View Contract
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive ml-auto">
                        <AlertCircle className="mr-2 h-4 w-4" />
                        Dispute
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>

          <TabsContent value="completed">
            <Card className="p-12 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No completed escrows</h3>
              <p className="text-sm text-muted-foreground">Completed escrows will appear here</p>
            </Card>
          </TabsContent>

          <TabsContent value="disputes">
            <Card className="p-12 text-center">
              <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No active disputes</h3>
              <p className="text-sm text-muted-foreground">All your transactions are going smoothly</p>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  )
}
