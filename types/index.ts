import type { Route as NextRoute } from "next"

export type AppRoute =
  | NextRoute
  | NextRoute<`/task/${string}`>
  | NextRoute<`/profile/${string}`>

export interface User {
  id: string
  username: string
  displayName: string
  email: string
  avatar: string
  bio: string
  reputation: number
  completedTasks: number
  totalEarned: number
  joinedAt: string
  isVerified: boolean
  role: 'user' | 'admin' | 'moderator'
  walletAddress?: string
  lightningAddress?: string
}

export interface Task {
  id: string
  title: string
  description: string
  category: string
  subcategory: string
  reward: number
  rewardCurrency: 'sats' | 'BSV'
  status: 'open' | 'in_progress' | 'completed' | 'disputed' | 'cancelled'
  employer: User
  freelancer?: User
  skills: string[]
  deadline: string
  createdAt: string
  updatedAt: string
  applicants: number
  maxApplicants: number
  difficulty: 'easy' | 'medium' | 'hard' | 'expert'
  featured: boolean
  escrowId?: string
}

export interface Transaction {
  id: string
  type: 'deposit' | 'withdrawal' | 'payment' | 'earning' | 'escrow' | 'refund'
  amount: number
  currency: 'sats' | 'BSV'
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  from?: string
  to?: string
  description: string
  createdAt: string
  txHash?: string
}

import type { Route } from "next"

export interface Message {
  id: string
  conversationId: string
  senderId: string
  content: string
  attachments?: string[]
  createdAt: string
  read: boolean
}

export interface Conversation {
  id: string
  participants: User[]
  lastMessage: Message
  unreadCount: number
  updatedAt: string
}

export interface Notification {
  id: string
  userId: string
  type: 'task' | 'payment' | 'message' | 'system' | 'escrow'
  title: string
  message: string
  read: boolean
  link?: AppRoute
  createdAt: string
}

export interface Escrow {
  id: string
  taskId: string
  amount: number
  status: 'funded' | 'released' | 'disputed' | 'refunded'
  fundedAt: string
  releasedAt?: string
  milestones: EscrowMilestone[]
}

export interface EscrowMilestone {
  id: string
  title: string
  amount: number
  status: 'pending' | 'completed' | 'disputed'
  completedAt?: string
}

export interface Review {
  id: string
  taskId: string
  reviewer: User
  reviewee: User
  rating: number
  comment: string
  createdAt: string
}

export interface FAQ {
  id: string
  question: string
  answer: string
  category: string
}

export interface Category {
  id: string
  name: string
  icon: string
  count: number
  subcategories: string[]
}
