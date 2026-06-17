# Request: Verify External Backend Shapes Before Removing Prisma

Goal: confirm the Flask external backend returns the exact response shapes the Next.js frontend expects. After this is confirmed, remove Prisma, `prisma/schema.prisma`, local `dev.db`, and all unused local database modules from the Next app.

## Current Next.js State

The Next.js app now proxies app API routes to the external backend through:

- `lib/server/bountybee-api.ts`
- `lib/server/bountybee-proxy.ts`

The `app` folder no longer imports Prisma. The app API routes are now forwarding to `/api/v1/*` on the external backend.

## Environment Required

Next.js needs:

```env
BOUNTYBEE_API_URL=http://external-backend-host
AUTH_API_URL=http://external-backend-host
AUTH_SERVICE_KEY=shared-service-key
JWT_SECRET=next-cookie-secret
```

## Backend Must Support These Auth Routes

```http
POST /api/v1/auth/signup
POST /api/v1/auth/login
POST /api/v1/auth/verify
POST /api/v1/auth/wallet-key
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
GET  /api/v1/auth/verify-email
```

Login must return:

```json
{
  "success": true,
  "user_id": 1,
  "email": "user@example.com",
  "address": "1BSVAddress...",
  "token": "external-session-token",
  "token_ttl_seconds": 604800
}
```

`GET /api/v1/users/me` must work with:

```http
Authorization: Bearer external-session-token
```

and return:

```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "alice",
    "displayName": "Alice",
    "avatarUrl": null
  },
  "wallet": {
    "address": "1BSVAddress...",
    "availableBalance": 0,
    "pendingBalance": 0,
    "reservedBalance": 0
  }
}
```

## Frontend Endpoint Shape Checks

Please verify these proxied routes return data compatible with the existing frontend.

### Public

```http
GET /api/v1/categories
GET /api/v1/tags
GET /api/v1/platform/stats
GET /api/v1/leaderboard
GET /api/v1/market/bsv-price
```

Platform stats must include:

```json
{
  "activeUsers": 0,
  "tasksPosted": 0,
  "totalEarned": 0,
  "averageRating": 0
}
```

BSV price should include either the old frontend-compatible shape:

```json
{
  "usd": 50,
  "estimated": false
}
```

or update the frontend to read:

```json
{
  "priceUsd": 50,
  "cached": true,
  "updatedAt": "2026-06-06T00:00:00.000Z"
}
```

### Marketplace And Tasks

```http
GET    /api/v1/marketplace/tasks
GET    /api/v1/marketplace/tasks/:id
POST   /api/v1/tasks/draft
GET    /api/v1/tasks/:id
DELETE /api/v1/tasks/:id
PUT    /api/v1/tasks/:id/step/:step
POST   /api/v1/tasks/:id/publish
POST   /api/v1/tasks/:id/apply
POST   /api/v1/tasks/:id/submit
GET    /api/v1/tasks/:id/submissions
POST   /api/v1/tasks/:id/approve
POST   /api/v1/tasks/:id/pause
POST   /api/v1/tasks/:id/duplicate
```

Marketplace list should return:

```json
{
  "tasks": [],
  "stats": {
    "totalTasks": 0,
    "featuredTasks": 0,
    "totalReward": 0,
    "matchingTasks": 0
  },
  "categories": []
}
```

Task cards need fields like:

```json
{
  "id": 1,
  "title": "Task title",
  "description": "Short text",
  "reward": 1000,
  "deadline": null,
  "category": "Development",
  "difficulty": "medium",
  "skills": ["nextjs"],
  "featured": false,
  "applicants": 0,
  "maxApplicants": 1,
  "createdAt": "2026-06-06T00:00:00.000Z",
  "status": "published",
  "employer": {
    "username": "alice",
    "displayName": "Alice",
    "avatar": null
  }
}
```

### Wallet

```http
GET  /api/v1/wallet
POST /api/v1/wallet/create
GET  /api/v1/wallet/deposit-address
GET  /api/v1/wallet/balance
POST /api/v1/wallet/sync
GET  /api/v1/wallet/history
GET  /api/v1/wallet/deposits
GET  /api/v1/wallet/withdrawals
GET  /api/v1/wallet/paymail/resolve?paymail=user@bountybee.io
POST /api/v1/wallet/withdraw
```

Wallet summary should include:

```json
{
  "address": "1BSVAddress...",
  "paymail": "alice@bountybee.io",
  "availableBalance": 0,
  "pendingBalance": 0,
  "reservedBalance": 0,
  "recentTransactions": []
}
```

Transactions must use explicit statuses:

- `pending`
- `completed`
- `failed`
- `cancelled`

Old completed transactions must not be returned as `pending`.

### Messages

```http
GET  /api/v1/messages/conversations
POST /api/v1/messages/conversations
GET  /api/v1/messages/conversations/:id/messages
POST /api/v1/messages/conversations/:id/messages
GET  /api/v1/messages/users?q=alice
```

Sending one message should create exactly one notification per recipient.

### Dashboard

```http
GET /api/v1/dashboard
GET /api/v1/dashboard/stats
GET /api/v1/dashboard/activity
GET /api/v1/dashboard/active-tasks
GET /api/v1/dashboard/tasks
GET /api/v1/dashboard/submissions
GET /api/v1/dashboard/escrows
GET /api/v1/dashboard/earnings
GET /api/v1/dashboard/top-tasks
GET /api/v1/dashboard/transactions
GET /api/v1/dashboard/wallet
GET /api/v1/dashboard/reputation
GET /api/v1/dashboard/notifications
PATCH /api/v1/dashboard/notifications
```

Dashboard amounts must be satoshis from the backend. The frontend can display BSV.

### Profile

```http
GET    /api/v1/profile/me
PATCH  /api/v1/profile/update
POST   /api/v1/profile/avatar
DELETE /api/v1/profile/avatar
GET    /api/v1/profile/portfolio
POST   /api/v1/profile/portfolio
PUT    /api/v1/profile/portfolio/:id
DELETE /api/v1/profile/portfolio/:id
GET    /api/v1/profile/:username
GET    /api/v1/profile/:username/stats
GET    /api/v1/profile/:username/tasks
GET    /api/v1/profile/:username/reviews
POST   /api/v1/reviews
```

Avatar upload must accept multipart form data with field name `file`.

### Escrow, Disputes, Admin

```http
POST /api/v1/escrow/create
GET  /api/v1/escrow/:id
POST /api/v1/escrow/:id/fund
POST /api/v1/escrow/:id/release
POST /api/v1/escrow/:id/refund
GET  /api/v1/escrow/employer
GET  /api/v1/escrow/worker
POST /api/v1/escrow/process-auto-releases
POST /api/v1/escrow/milestones/:id/release

GET  /api/v1/disputes
POST /api/v1/disputes
GET  /api/v1/disputes/:id/comments
POST /api/v1/disputes/:id/comments
POST /api/v1/disputes/:id/resolve

GET    /api/v1/admin/analytics
GET    /api/v1/admin/escrows
PATCH  /api/v1/admin/tasks/:id
DELETE /api/v1/admin/tasks/:id
PATCH  /api/v1/admin/users/:id
DELETE /api/v1/admin/users/:id
```

Admin permissions must be enforced by the external backend.

## BSV Signing Requirement

Do not use server-side plaintext private keys.

For real BSV payout/withdrawal, use the client-signed flow:

```http
POST /api/v1/wallet/withdraw/quote
POST /api/v1/wallet/withdraw/broadcast
```

The browser gets the encrypted key from:

```http
POST /api/v1/auth/wallet-key
```

then decrypts/signs locally with the user password.

## Confirmation Needed Before Removing Prisma

Please confirm:

- All endpoints above exist.
- All protected routes accept `Authorization: Bearer external-session-token`.
- `GET /api/v1/users/me` returns the external user using the same `user_id` from auth.
- All balances and rewards are integer satoshis.
- All transaction statuses are explicit.
- Notifications use dedupe keys and do not create duplicate rows.
- Message user search finds all external users, not only old local users.
- Paymail resolve searches external users.
- Task publish/approve updates external task, balance, escrow, transaction, and notification records.
- Admin analytics/users/tasks/escrows are calculated from the external backend database.

After confirmation, remove from Next.js:

- `@prisma/client`
- `prisma`
- `@prisma/adapter-better-sqlite3`
- `better-sqlite3`
- `prisma/schema.prisma`
- `prisma/dev.db`
- local `dev.db`
- `lib/server/prisma.ts`
- unused local database modules that are no longer imported

Final validation after removal:

```powershell
rg "@/lib/server/prisma|from .*prisma|prisma\\." app lib
npm install
npx tsc --noEmit
npm run build
```
