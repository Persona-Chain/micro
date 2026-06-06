"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, CheckCheck, MessageSquare, Plus, Search, Send } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { cn, timeAgo } from "@/lib/utils"

type ChatUser = {
  id: number
  username: string
  displayName: string
  avatarUrl?: string | null
}

type ChatMessage = {
  id: number
  conversationId: number
  senderId: number
  content: string
  read: boolean
  readAt?: string | null
  createdAt: string
}

type Conversation = {
  id: number
  type: string
  participants: ChatUser[]
  otherParticipants: ChatUser[]
  lastMessage: ChatMessage | null
  unreadCount: number
  updatedAt: string
}

function userInitial(user?: ChatUser | null) {
  return (user?.displayName || user?.username || "?").slice(0, 1).toUpperCase()
}

function MessagesContent() {
  const searchParams = useSearchParams()
  const requestedUsername = searchParams.get("user")?.trim() || ""
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageInput, setMessageInput] = useState("")
  const [conversationQuery, setConversationQuery] = useState("")
  const [conversationUserResults, setConversationUserResults] = useState<ChatUser[]>([])
  const [userQuery, setUserQuery] = useState("")
  const [userResults, setUserResults] = useState<ChatUser[]>([])
  const [showNewChat, setShowNewChat] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [searchingConversationUsers, setSearchingConversationUsers] = useState(false)
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userSearchError, setUserSearchError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const handledRequestedUsernameRef = useRef("")

  const selectedConversation = conversations.find((conversation) => conversation.id === selectedId) ?? null
  const otherUser = selectedConversation?.otherParticipants[0] ?? null
  const filteredConversations = useMemo(() => {
    const q = conversationQuery.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((conversation) => {
      const other = conversation.otherParticipants[0]
      return (
        other?.displayName.toLowerCase().includes(q) ||
        other?.username.toLowerCase().includes(q) ||
        conversation.lastMessage?.content.toLowerCase().includes(q)
      )
    })
  }, [conversationQuery, conversations])

  const loadConversations = useCallback(async (selectFirst = false) => {
    const res = await fetch("/api/messages/conversations", { cache: "no-store" })
    if (!res.ok) throw new Error("Failed to load conversations")
    const data = await res.json()
    const next = Array.isArray(data) ? data : []
    setConversations(next)
    if (selectFirst) {
      setSelectedId((current) => current ?? next[0]?.id ?? null)
    }
  }, [])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const loadMessages = useCallback(async (conversationId: number, incremental = false) => {
    const currentMessages = messagesRef.current
    const afterId = incremental && currentMessages.length > 0 ? Math.max(...currentMessages.map((message) => message.id)) : 0
    const url = afterId
      ? `/api/messages/conversations/${conversationId}/messages?afterId=${afterId}`
      : `/api/messages/conversations/${conversationId}/messages`
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) throw new Error("Failed to load messages")
    const data = await res.json()
    const nextMessages = Array.isArray(data?.messages) ? data.messages : []
    setMessages((current) => {
      if (!incremental) return nextMessages
      const existingIds = new Set(current.map((message) => message.id))
      return [...current, ...nextMessages.filter((message: ChatMessage) => !existingIds.has(message.id))]
    })
  }, [])

  async function searchUsers(q: string, signal?: AbortSignal) {
    const res = await fetch(`/api/messages/users?q=${encodeURIComponent(q)}`, {
      cache: "no-store",
      signal,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.message || "Unable to search users")
    return Array.isArray(data) ? (data as ChatUser[]) : []
  }

  const startConversation = useCallback(async (user: ChatUser) => {
    const res = await fetch("/api/messages/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: user.id }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setError(data?.message || "Unable to start conversation")
      return
    }
    await loadConversations()
    setSelectedId(Number(data?.id))
    setShowNewChat(false)
    setUserQuery("")
    setUserResults([])
  }, [loadConversations])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const authRes = await fetch("/api/auth/me", { cache: "no-store" })
        const authData = authRes.ok ? await authRes.json().catch(() => null) : null
        const id = Number(authData?.user?.id)
        if (Number.isFinite(id)) setCurrentUserId(id)
        await loadConversations(true)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load messages")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [loadConversations])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }

    let cancelled = false
    setLoadingMessages(true)
    loadMessages(selectedId)
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load messages")
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedId, loadMessages])

  useEffect(() => {
    if (!selectedId) return
    window.clearInterval(pollRef.current ?? undefined)
    pollRef.current = window.setInterval(() => {
      loadMessages(selectedId, true).catch(() => undefined)
      loadConversations().catch(() => undefined)
    }, 2500)

    return () => window.clearInterval(pollRef.current ?? undefined)
  }, [selectedId, loadMessages, loadConversations])

  useEffect(() => {
    const q = conversationQuery.trim()
    if (q.length < 1) {
      setConversationUserResults([])
      setSearchingConversationUsers(false)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setSearchingConversationUsers(true)
      try {
        const users = await searchUsers(q, controller.signal)
        if (!controller.signal.aborted) setConversationUserResults(users)
      } catch {
        if (!controller.signal.aborted) setConversationUserResults([])
      } finally {
        if (!controller.signal.aborted) setSearchingConversationUsers(false)
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [conversationQuery])

  useEffect(() => {
    if (loading || !requestedUsername || handledRequestedUsernameRef.current === requestedUsername) return
    handledRequestedUsernameRef.current = requestedUsername

    ;(async () => {
      try {
        const users = await searchUsers(requestedUsername)
        const target =
          users.find((user) => user.username.toLowerCase() === requestedUsername.toLowerCase()) ??
          users[0]
        if (target) {
          await startConversation(target)
        } else {
          setShowNewChat(true)
          setUserQuery(requestedUsername)
          setError(`No user found for @${requestedUsername}`)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to open conversation")
      }
    })()
  }, [loading, requestedUsername, startConversation])

  useEffect(() => {
    const q = userQuery.trim()
    if (q.length < 1) {
      setUserResults([])
      setUserSearchError(null)
      setSearchingUsers(false)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setSearchingUsers(true)
      setUserSearchError(null)
      try {
        const users = await searchUsers(q, controller.signal)
        if (!controller.signal.aborted) setUserResults(users)
      } catch (e) {
        if (!controller.signal.aborted) {
          setUserResults([])
          setUserSearchError(e instanceof Error ? e.message : "Unable to search users")
        }
      } finally {
        if (!controller.signal.aborted) setSearchingUsers(false)
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [userQuery])

  async function handleSendMessage() {
    const content = messageInput.trim()
    if (!selectedId || !content) return

    setIsSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/messages/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message || "Unable to send message")
      setMessages((current) => [...current, data])
      setMessageInput("")
      await loadConversations()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send message")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="h-[calc(100dvh-4rem)] flex bg-background overflow-hidden">
      <div className={cn("w-full sm:w-80 border-r border-border/40 flex-col", selectedConversation ? "hidden sm:flex" : "flex")}>
        <div className="p-4 border-b border-border/40 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Messages</h2>
            <Button variant="ghost" size="icon-sm" onClick={() => setShowNewChat((value) => !value)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations or users..."
              className="pl-10"
              value={conversationQuery}
              onChange={(e) => setConversationQuery(e.target.value)}
            />
          </div>
          {showNewChat ? (
            <div className="rounded-lg border border-border/50 bg-muted/30 p-2 space-y-2">
              <Input
                placeholder="Find user by name..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
              />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {searchingUsers ? (
                  <p className="px-2 py-3 text-xs text-muted-foreground">Searching...</p>
                ) : null}
                {userSearchError ? (
                  <p className="px-2 py-3 text-xs text-destructive">{userSearchError}</p>
                ) : null}
                {userResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => startConversation(user)}
                    className="w-full flex items-center gap-2 rounded-md p-2 text-left hover:bg-accent"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatarUrl ?? undefined} />
                      <AvatarFallback>{userInitial(user)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{user.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                    </div>
                  </button>
                ))}
                {userQuery.trim().length >= 1 && !searchingUsers && !userSearchError && userResults.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-muted-foreground">No users found</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading conversations...</p>
            ) : (
              <>
                {conversationQuery.trim().length >= 1 ? (
                  <div className="px-2 pb-2">
                    <p className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      People
                    </p>
                    {searchingConversationUsers ? (
                      <p className="rounded-md px-2 py-3 text-xs text-muted-foreground">Searching users...</p>
                    ) : null}
                    {!searchingConversationUsers && conversationUserResults.length === 0 ? (
                      <p className="rounded-md px-2 py-3 text-xs text-muted-foreground">No users found</p>
                    ) : null}
                    {conversationUserResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => startConversation(user)}
                        className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-accent"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatarUrl ?? undefined} />
                          <AvatarFallback>{userInitial(user)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{user.displayName}</p>
                          <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}

                {filteredConversations.length > 0 ? (
                  filteredConversations.map((conversation) => {
                    const other = conversation.otherParticipants[0]
                    return (
                      <button
                        key={conversation.id}
                        onClick={() => setSelectedId(conversation.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 text-left",
                          selectedId === conversation.id ? "bg-accent" : "hover:bg-accent/50",
                        )}
                      >
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={other?.avatarUrl ?? undefined} />
                            <AvatarFallback>{userInitial(other)}</AvatarFallback>
                          </Avatar>
                          {conversation.unreadCount > 0 ? (
                            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 p-0 px-1 flex items-center justify-center text-[10px] bg-bitcoin-500">
                              {conversation.unreadCount}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm truncate">{other?.displayName || "Conversation"}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {timeAgo(conversation.lastMessage?.createdAt || conversation.updatedAt)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {conversation.lastMessage?.content || "No messages yet"}
                          </p>
                        </div>
                      </button>
                    )
                  })
                ) : (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    No conversations yet
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className={cn("min-w-0 flex-1 flex-col", selectedConversation ? "flex" : "hidden sm:flex")}>
        {selectedConversation ? (
          <>
            <div className="flex items-center justify-between p-4 border-b border-border/40">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon-sm" className="sm:hidden" onClick={() => setSelectedId(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={otherUser?.avatarUrl ?? undefined} />
                  <AvatarFallback>{userInitial(otherUser)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{otherUser?.displayName || "Conversation"}</p>
                  <p className="text-xs text-muted-foreground truncate">@{otherUser?.username || "user"}</p>
                </div>
              </div>
              <Badge variant="outline" className="hidden min-[420px]:inline-flex text-[10px]">Live polling</Badge>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {loadingMessages ? (
                  <p className="text-center text-sm text-muted-foreground">Loading messages...</p>
                ) : null}
                <AnimatePresence>
                  {messages.map((message, index) => {
                    const isMe = message.senderId === currentUserId
                    const showAvatar = index === 0 || messages[index - 1].senderId !== message.senderId

                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn("flex gap-3", isMe ? "flex-row-reverse" : "flex-row")}
                      >
                        {showAvatar && !isMe ? (
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={otherUser?.avatarUrl ?? undefined} />
                            <AvatarFallback className="text-xs">{userInitial(otherUser)}</AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="w-8 shrink-0" />
                        )}
                        <div
                          className={cn(
                            "max-w-[70%] rounded-2xl px-4 py-2.5 break-words",
                            isMe ? "bg-bitcoin-500 text-white rounded-br-md" : "bg-muted rounded-bl-md",
                          )}
                        >
                          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                          <div className={cn("flex items-center gap-1 mt-1", isMe ? "text-white/70" : "text-muted-foreground")}>
                            <span className="text-[10px]">{timeAgo(message.createdAt)}</span>
                            {isMe ? <CheckCheck className="h-3 w-3" /> : null}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
                {!loadingMessages && messages.length === 0 ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">Start the conversation</div>
                ) : null}
              </div>
            </ScrollArea>

            {error ? <p className="px-4 pt-2 text-sm text-destructive">{error}</p> : null}
            <div className="p-4 border-t border-border/40">
              <div className="flex items-end gap-2">
                <Textarea
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  className="min-h-10 max-h-32 flex-1 resize-none"
                />
                <Button
                  size="sm"
                  className="bg-bitcoin-500 hover:bg-bitcoin-600 text-white"
                  onClick={handleSendMessage}
                  disabled={isSending || !messageInput.trim()}
                >
                  {isSending ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-50" />
              <p className="text-sm">Select a conversation or start a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading messages...</div>}>
      <MessagesContent />
    </Suspense>
  )
}
