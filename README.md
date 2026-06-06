# Bountybee

A modern, premium Bitcoin-powered micro-freelancing platform built with Next.js 15, TypeScript, Tailwind CSS, and shadcn/ui.

## Features

- **BitcoinSV** - Instant payments via BSV
- **Secure Escrow** - Multi-signature escrow protection
- **Modern UI/UX** - Dark mode by default, glassmorphism, smooth animations
- **Responsive Design** - Mobile-first, works on all devices
- **15+ Pages** - Complete platform with all essential features

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion
- Recharts
- Radix UI Primitives

## Getting Started

```bash
# Install dependencies
npm install

# Create SQLite DB file (required for Prisma SQLite on Windows)
# PowerShell:
New-Item -ItemType File -Path .\\dev.db -Force
# (or mac/linux)
# touch dev.db

# Set up local SQLite DB
npx prisma migrate dev

# Optional: seed test users
npm run db:seed

# Run development server
npm run dev

# Build for production
npm run build
```

## Authentication Backend

API routes (Next.js App Router):

- `POST /api/auth/register`
- `GET /api/auth/verify-email?token=TOKEN`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Dev note: email verification + password reset links are logged to the server console (no external email service needed).

## Wallet Backend (BSV mainnet)

Non-custodial keys are generated per-user and stored encrypted in SQLite.

Endpoints:

- `POST /api/wallet/create`
- `GET /api/wallet`
- `GET /api/wallet/balance`
- `GET /api/wallet/deposit-address`
- `POST /api/wallet/sync` (pulls UTXOs + updates internal balances)
- `POST /api/wallet/withdraw`
- `GET /api/wallet/deposits`
- `GET /api/wallet/withdrawals`
- `GET /api/wallet/history`

Notes:

- Uses WhatsOnChain for UTXO lookup + broadcasting (no custody, just a public API). Set `WHATSONCHAIN_API_KEY` for higher rate limits.
- `WALLET_MASTER_KEY` encrypts private keys at rest (AES-256-GCM). Change it in production.

## Project Structure

```
app/
  (auth)/          # Authentication pages (login, register, etc.)
  (dashboard)/     # Dashboard pages with sidebar layout
  page.tsx         # Landing page
  layout.tsx       # Root layout with theme provider
components/
  ui/              # shadcn/ui components
  layout/          # Layout components (Navbar, Sidebar, Footer)
  landing/         # Landing page sections
data/
  sample-data.ts   # Realistic sample data
types/
  index.ts         # TypeScript types
lib/
  utils.ts         # Utility functions
```

## Pages

1. Landing Page - Hero, Features, How It Works, Stats, Testimonials, FAQ (done)
2. Authentication - Login, Register, Forgot Password, Verify Email       (done) 
3. Dashboard - Balance, Earnings Chart, Active Tasks, Transactions       (done)
4. Marketplace - Search, Filters, Task Cards, Sorting                    (done)
5. Task Details - Description, Requirements, Submit Work, Timeline       (done)
6. Create Task - Multi-step wizard                                       (done)
7. User Profile - Avatar, Reputation, Reviews, Portfolio                 (done)
8. Wallet - bitcoinsv/On-chain, Deposit, Withdraw, History               (done)
9. Escrow - Status, Milestones, Release, Disputes                        (done)
10. Messages - Real-time chat, Conversations
11. Notifications - Activity                                             (done)
12. Admin Dashboard - Users, Tasks, Analytics                            (done)
13. Settings - Profile, Security, Wallet, Notifications, API             (done)
14. Leaderboard - Top Earners, Employers, Reputation                     (done)
15. Help Center - Knowledge Base, FAQ, Contact, Tickets
