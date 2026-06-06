# BountyBee External App API

This document defines the external backend needed to run BountyBee without the local SQLite `dev.db`.

`AUTH_API.md` only handles signup, login, session verification, and encrypted wallet-key lookup. This API stores the rest of the app data: profiles, tasks, wallet balances, transactions, messages, notifications, escrows, disputes, reviews, admin analytics, and dashboard data.

## Goal

After this API is implemented and BountyBee routes are migrated to it:

- No app state is stored in `dev.db`.
- `DATABASE_URL` is no longer required by the Next.js app.
- The app does not import Prisma for runtime data.
- All user IDs come from the external auth service.
- Wallet/private-key storage is handled by external auth or a dedicated wallet service, never by local SQLite.

## Auth

User-facing routes use the auth session token returned by `AUTH_API.md`.

```http
Authorization: Bearer external-session-token
Content-Type: application/json
```

Server/internal/admin routes use a service key.

```http
X-Service-Key: shared-long-random-secret
Content-Type: application/json
```

The external app API should verify user tokens by calling:

```http
POST /api/v1/auth/verify
```

from `AUTH_API.md`. The returned `user_id` is the stable foreign key for all records in this API.

## Common Rules

- All dates are UTC ISO strings, for example `2026-06-06T12:00:00.000Z`.
- All BSV amounts are integer satoshis, not decimal BSV.
- UI can convert satoshis to BSV, but the API must stay integer-safe.
- IDs can be numbers or strings, but they must be stable and unique.
- Pagination uses `limit` and `cursor`.
- Responses should include `success: true` for mutations.
- Errors use the same shape everywhere.

```json
{
  "success": false,
  "message": "Human readable error",
  "details": {}
}
```

## Data Models

These are the minimum models the external database needs. Field names can differ internally, but API responses should match this contract.

### User

The auth service owns email, password, 2FA, and session tokens. The app API owns BountyBee profile data.

```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "alice",
  "displayName": "Alice",
  "bio": "BSV builder",
  "location": "Paris",
  "website": "https://example.com",
  "github": "alice",
  "twitter": "alice",
  "avatarUrl": "https://cdn.example.com/avatar.png",
  "reputationScore": 0,
  "averageRating": 0,
  "totalReviews": 0,
  "totalCompletedTasks": 0,
  "createdAt": "2026-06-06T12:00:00.000Z",
  "updatedAt": "2026-06-06T12:00:00.000Z"
}
```

Required unique fields:

- `id`
- `email`
- `username`

### Wallet

If wallet keys remain in external auth, this API only stores public wallet metadata and balance state.

```json
{
  "userId": 1,
  "address": "1BSVAddress...",
  "publicKey": "public-key",
  "availableBalance": 100000,
  "pendingBalance": 0,
  "reservedBalance": 50000,
  "updatedAt": "2026-06-06T12:00:00.000Z"
}
```

### Transaction

```json
{
  "id": 100,
  "userId": 1,
  "txid": "transaction-id",
  "type": "deposit",
  "amount": 100000,
  "fee": 120,
  "confirmations": 1,
  "status": "completed",
  "address": "1BSVAddress...",
  "taskId": 20,
  "escrowId": 30,
  "createdAt": "2026-06-06T12:00:00.000Z"
}
```

Statuses:

- `pending`
- `completed`
- `failed`
- `cancelled`

Types:

- `deposit`
- `withdrawal`
- `task_fee`
- `task_reward`
- `escrow_fund`
- `escrow_release`
- `escrow_refund`
- `platform_fee`

### Task

```json
{
  "id": 20,
  "userId": 1,
  "title": "Build a landing page",
  "slug": "build-a-landing-page",
  "shortDescription": "Create a responsive page",
  "fullDescription": "Full task details",
  "requirements": "Requirements",
  "instructions": "Instructions",
  "rewardAmount": 100000,
  "currency": "BSV",
  "maxWorkers": 1,
  "estimatedCompletionTime": 120,
  "expirationDate": "2026-07-01T00:00:00.000Z",
  "visibility": "public",
  "featuredTask": false,
  "autoApprove": false,
  "autoReleaseAfterDays": 3,
  "status": "open",
  "moderationStatus": "approved",
  "categoryId": 2,
  "category": {
    "id": 2,
    "name": "Development",
    "slug": "development",
    "icon": "code"
  },
  "tags": ["nextjs", "frontend"],
  "attachments": [],
  "lockedRewardTotal": 100000,
  "step1Complete": true,
  "step2Complete": true,
  "step3Complete": true,
  "step4Complete": true,
  "createdAt": "2026-06-06T12:00:00.000Z",
  "updatedAt": "2026-06-06T12:00:00.000Z",
  "publishedAt": "2026-06-06T12:10:00.000Z"
}
```

Task statuses:

- `draft`
- `open`
- `in_progress`
- `completed`
- `paused`
- `cancelled`

Moderation statuses:

- `pending`
- `approved`
- `rejected`

### Application

```json
{
  "id": 1,
  "taskId": 20,
  "userId": 2,
  "status": "applied",
  "createdAt": "2026-06-06T12:00:00.000Z"
}
```

Statuses:

- `applied`
- `accepted`
- `rejected`
- `withdrawn`

### Submission

```json
{
  "id": 1,
  "taskId": 20,
  "userId": 2,
  "message": "Work completed",
  "status": "submitted",
  "createdAt": "2026-06-06T12:00:00.000Z",
  "updatedAt": "2026-06-06T12:00:00.000Z",
  "decidedAt": null,
  "paidAt": null,
  "payoutTxid": null
}
```

Statuses:

- `submitted`
- `approved`
- `rejected`
- `paid`

### Escrow

```json
{
  "id": 30,
  "taskId": 20,
  "employerId": 1,
  "workerId": 2,
  "amount": 100000,
  "feeAmount": 5000,
  "netAmount": 95000,
  "status": "funded",
  "fundedAt": "2026-06-06T12:00:00.000Z",
  "releasedAt": null,
  "refundedAt": null,
  "disputedAt": null,
  "cancelledAt": null,
  "createdAt": "2026-06-06T12:00:00.000Z",
  "updatedAt": "2026-06-06T12:00:00.000Z"
}
```

Statuses:

- `pending_funding`
- `funded`
- `released`
- `refunded`
- `disputed`
- `cancelled`

### Conversation

```json
{
  "id": 1,
  "type": "direct",
  "participants": [
    {
      "userId": 1,
      "username": "alice",
      "displayName": "Alice",
      "avatarUrl": null,
      "lastReadAt": "2026-06-06T12:00:00.000Z"
    }
  ],
  "lastMessage": {
    "id": 10,
    "senderId": 1,
    "content": "Hello",
    "createdAt": "2026-06-06T12:00:00.000Z"
  },
  "unreadCount": 0,
  "createdAt": "2026-06-06T12:00:00.000Z",
  "updatedAt": "2026-06-06T12:00:00.000Z"
}
```

### Message

```json
{
  "id": 10,
  "conversationId": 1,
  "senderId": 1,
  "content": "Hello",
  "readAt": null,
  "createdAt": "2026-06-06T12:00:00.000Z",
  "updatedAt": "2026-06-06T12:00:00.000Z"
}
```

### Notification

```json
{
  "id": 1,
  "userId": 1,
  "type": "message",
  "message": "New message from Alice",
  "link": "/messages?conversation=1",
  "read": false,
  "dedupeKey": "message:1:10",
  "createdAt": "2026-06-06T12:00:00.000Z"
}
```

The backend must enforce dedupe for repeated notifications. Use a unique `dedupeKey` when possible.

## Endpoints

### User And Profile

#### Get Current User

```http
GET /api/v1/users/me
Authorization: Bearer external-session-token
```

Response:

```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "alice",
    "displayName": "Alice",
    "avatarUrl": null,
    "reputationScore": 0,
    "averageRating": 0,
    "totalReviews": 0,
    "totalCompletedTasks": 0
  },
  "wallet": {
    "address": "1BSVAddress...",
    "availableBalance": 0,
    "pendingBalance": 0,
    "reservedBalance": 0
  }
}
```

#### Sync User After Signup Or Login

Used when auth created the user but the app profile row does not exist yet.

```http
POST /api/v1/users/sync
Authorization: Bearer external-session-token
```

Request:

```json
{
  "username": "alice",
  "displayName": "Alice",
  "address": "1BSVAddress...",
  "publicKey": "public-key"
}
```

Response:

```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "alice"
  }
}
```

#### Search Users

```http
GET /api/v1/users/search?q=ali&limit=10
Authorization: Bearer external-session-token
```

Response:

```json
{
  "users": [
    {
      "id": 1,
      "username": "alice",
      "displayName": "Alice",
      "avatarUrl": null
    }
  ]
}
```

#### Get Public Profile

```http
GET /api/v1/users/:username
```

#### Update My Profile

```http
PATCH /api/v1/users/me/profile
Authorization: Bearer external-session-token
```

### Account Settings

#### Notification Preferences

```http
GET /api/v1/account/notification-preferences
PUT /api/v1/account/notification-preferences
Authorization: Bearer external-session-token
```

Request:

```json
{
  "emailNotifications": true,
  "pushNotifications": true,
  "taskUpdates": true,
  "paymentAlerts": true,
  "notificationSound": true,
  "marketing": false
}
```

#### API Keys

```http
GET /api/v1/account/api-keys
POST /api/v1/account/api-keys
DELETE /api/v1/account/api-keys/:id
Authorization: Bearer external-session-token
```

### Categories And Tags

```http
GET /api/v1/categories
GET /api/v1/tags
```

### Marketplace And Tasks

#### List Marketplace Tasks

```http
GET /api/v1/marketplace/tasks?status=open&category=development&query=nextjs&limit=20&cursor=
```

Response:

```json
{
  "tasks": [
    {
      "id": 20,
      "title": "Build a landing page",
      "slug": "build-a-landing-page",
      "shortDescription": "Create a responsive page",
      "rewardAmount": 100000,
      "currency": "BSV",
      "status": "open",
      "category": {
        "name": "Development",
        "slug": "development"
      },
      "tags": ["nextjs"],
      "employer": {
        "id": 1,
        "username": "alice",
        "displayName": "Alice",
        "avatarUrl": null
      },
      "createdAt": "2026-06-06T12:00:00.000Z"
    }
  ],
  "nextCursor": null
}
```

#### Get Task Detail

```http
GET /api/v1/marketplace/tasks/:id
Authorization: Bearer external-session-token
```

The auth header is optional, but if present the response should include viewer-specific flags.

Response:

```json
{
  "task": {
    "id": 20,
    "title": "Build a landing page",
    "fullDescription": "Full task details",
    "requirements": "Requirements",
    "instructions": "Instructions",
    "rewardAmount": 100000,
    "currency": "BSV",
    "status": "open",
    "moderationStatus": "approved",
    "employer": {
      "id": 1,
      "username": "alice",
      "displayName": "Alice",
      "avatarUrl": null
    },
    "applicationsCount": 3,
    "submissionsCount": 0,
    "viewer": {
      "isOwner": false,
      "hasApplied": false,
      "hasSubmitted": false
    }
  }
}
```

#### Create Draft

```http
POST /api/v1/tasks/draft
Authorization: Bearer external-session-token
```

Response:

```json
{
  "success": true,
  "task": {
    "id": 20,
    "status": "draft"
  }
}
```

#### Update Draft Step

```http
PUT /api/v1/tasks/:id/step/:step
Authorization: Bearer external-session-token
```

`step` is `1`, `2`, `3`, or `4`.

#### Publish Task

Publishing must reserve reward funds, create escrow, send/record platform fee, and mark the task open only after funding succeeds.

```http
POST /api/v1/tasks/:id/publish
Authorization: Bearer external-session-token
```

Response:

```json
{
  "success": true,
  "task": {
    "id": 20,
    "status": "open",
    "rewardAmount": 100000,
    "lockedRewardTotal": 100000
  },
  "escrow": {
    "id": 30,
    "status": "funded",
    "amount": 100000,
    "feeAmount": 5000,
    "netAmount": 95000
  },
  "transactions": [
    {
      "type": "task_fee",
      "status": "completed",
      "amount": 5000,
      "txid": "fee-txid"
    }
  ]
}
```

#### Apply To Task

```http
POST /api/v1/tasks/:id/apply
Authorization: Bearer external-session-token
```

Response:

```json
{
  "success": true,
  "application": {
    "id": 1,
    "taskId": 20,
    "userId": 2,
    "status": "applied"
  }
}
```

#### Submit Work

```http
POST /api/v1/tasks/:id/submit
Authorization: Bearer external-session-token
```

Request:

```json
{
  "message": "Work completed",
  "attachments": []
}
```

#### List Submissions

```http
GET /api/v1/tasks/:id/submissions
Authorization: Bearer external-session-token
```

Only the employer/admin can list all submissions. A worker can list their own submission.

#### Approve Submission And Pay Worker

Approving a submission must release reward to the worker address. The API should fail loudly if payout fails.

```http
POST /api/v1/tasks/:id/approve
Authorization: Bearer external-session-token
```

Request:

```json
{
  "submissionId": 1
}
```

Response:

```json
{
  "success": true,
  "submission": {
    "id": 1,
    "status": "paid",
    "paidAt": "2026-06-06T12:00:00.000Z",
    "payoutTxid": "worker-payout-txid"
  },
  "transaction": {
    "type": "task_reward",
    "status": "completed",
    "amount": 95000,
    "txid": "worker-payout-txid"
  }
}
```

#### Other Task Routes

```http
GET /api/v1/tasks/:id
DELETE /api/v1/tasks/:id
POST /api/v1/tasks/:id/pause
POST /api/v1/tasks/:id/duplicate
```

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
Authorization: Bearer external-session-token
```

Dashboard values must be derived from the external database. Rewards and balances are returned as satoshis.

### Wallet

#### Wallet Summary

```http
GET /api/v1/wallet
Authorization: Bearer external-session-token
```

Response:

```json
{
  "wallet": {
    "address": "1BSVAddress...",
    "paymail": "alice@bountybee.io",
    "availableBalance": 100000,
    "pendingBalance": 0,
    "reservedBalance": 50000
  },
  "recentTransactions": [
    {
      "id": 1,
      "txid": "txid",
      "type": "deposit",
      "amount": 100000,
      "status": "completed",
      "confirmations": 1,
      "createdAt": "2026-06-06T12:00:00.000Z"
    }
  ]
}
```

#### Wallet Routes

```http
POST /api/v1/wallet/create
GET /api/v1/wallet/deposit-address
GET /api/v1/wallet/balance
POST /api/v1/wallet/sync
GET /api/v1/wallet/history?limit=20&cursor=
GET /api/v1/wallet/deposits?limit=20&cursor=
GET /api/v1/wallet/withdrawals?limit=20&cursor=
GET /api/v1/wallet/paymail/resolve?paymail=user@bountybee.io
POST /api/v1/wallet/withdraw
Authorization: Bearer external-session-token
```

#### Withdraw

If the external backend owns transaction signing, use:

```http
POST /api/v1/wallet/withdraw
Authorization: Bearer external-session-token
```

Request:

```json
{
  "to": "1DestinationAddress...",
  "amount": 50000
}
```

Response:

```json
{
  "success": true,
  "transaction": {
    "txid": "withdrawal-txid",
    "type": "withdrawal",
    "amount": 50000,
    "fee": 120,
    "status": "completed"
  }
}
```

If the external backend must never decrypt/sign private keys, use a client-signed flow:

```http
POST /api/v1/wallet/withdraw/quote
POST /api/v1/wallet/withdraw/broadcast
Authorization: Bearer external-session-token
```

The quote route returns unsigned transaction data. The client signs locally after decrypting the wallet key from `AUTH_API.md`, then broadcasts signed raw transaction data to `/broadcast`.

### Messages

#### List Conversations

```http
GET /api/v1/messages/conversations
Authorization: Bearer external-session-token
```

#### Create Or Open Direct Conversation

```http
POST /api/v1/messages/conversations
Authorization: Bearer external-session-token
```

Request:

```json
{
  "participantUserId": 2
}
```

Response:

```json
{
  "success": true,
  "conversation": {
    "id": 1,
    "type": "direct"
  }
}
```

#### List Messages

```http
GET /api/v1/messages/conversations/:id/messages?limit=50&cursor=
Authorization: Bearer external-session-token
```

#### Send Message

```http
POST /api/v1/messages/conversations/:id/messages
Authorization: Bearer external-session-token
```

Request:

```json
{
  "content": "Hello"
}
```

Response:

```json
{
  "success": true,
  "message": {
    "id": 10,
    "conversationId": 1,
    "senderId": 1,
    "content": "Hello",
    "createdAt": "2026-06-06T12:00:00.000Z"
  },
  "notification": {
    "id": 20,
    "type": "message",
    "dedupeKey": "message:1:10"
  }
}
```

Sending a message should create exactly one notification per recipient.

#### Search Message Users

```http
GET /api/v1/messages/users?q=alice&limit=10
Authorization: Bearer external-session-token
```

### Notifications

```http
GET /api/v1/notifications?unreadOnly=false&limit=20&cursor=
PATCH /api/v1/notifications/:id/read
PATCH /api/v1/notifications/read-all
Authorization: Bearer external-session-token
```

Internal route for backend events:

```http
POST /api/v1/notifications
X-Service-Key: shared-long-random-secret
```

Request:

```json
{
  "userId": 1,
  "type": "task_created",
  "message": "Your task was created",
  "link": "/task/20",
  "dedupeKey": "task_created:20"
}
```

`dedupeKey` should be unique. This prevents the repeated 3 or 4 duplicate notifications problem.

### Escrow

```http
POST /api/v1/escrow/create
GET /api/v1/escrow/:id
POST /api/v1/escrow/:id/fund
POST /api/v1/escrow/:id/release
POST /api/v1/escrow/:id/refund
GET /api/v1/escrow/employer
GET /api/v1/escrow/worker
POST /api/v1/escrow/process-auto-releases
POST /api/v1/escrow/milestones/:id/release
Authorization: Bearer external-session-token
```

`process-auto-releases` can also accept `X-Service-Key` for cron jobs.

### Disputes

```http
GET /api/v1/disputes
POST /api/v1/disputes
GET /api/v1/disputes/:id/comments
POST /api/v1/disputes/:id/comments
POST /api/v1/disputes/:id/resolve
Authorization: Bearer external-session-token
```

Admin-only resolution should also accept `X-Service-Key`.

### Reviews

```http
GET /api/v1/users/:username/reviews
POST /api/v1/reviews
Authorization: Bearer external-session-token
```

Review creation must update the target user's:

- `averageRating`
- `totalReviews`
- `reputationScore`

### Portfolio And Avatar

```http
GET /api/v1/users/:username/portfolio
POST /api/v1/profile/portfolio
PATCH /api/v1/profile/portfolio/:id
DELETE /api/v1/profile/portfolio/:id
POST /api/v1/profile/avatar
DELETE /api/v1/profile/avatar
Authorization: Bearer external-session-token
```

Avatar upload can use multipart form data or a separate object-storage upload flow.

### Platform Public Data

These routes power the index page and public stats.

```http
GET /api/v1/platform/stats
GET /api/v1/leaderboard
GET /api/v1/market/bsv-price
```

Platform stats response:

```json
{
  "activeUsers": 12543,
  "tasksPosted": 8932,
  "totalEarned": 158000000000,
  "averageRating": 4.8
}
```

`totalEarned` is satoshis.

### Admin

Admin routes require either an admin user token or `X-Service-Key`.

```http
GET /api/v1/admin/analytics
GET /api/v1/admin/escrows
PATCH /api/v1/admin/tasks/:id
DELETE /api/v1/admin/tasks/:id
PATCH /api/v1/admin/users/:id
DELETE /api/v1/admin/users/:id
```

Admin user list must return balances in satoshis. The UI can display BSV.

## Required Backend Behavior

### Notification Dedupe

For every notification event, build a stable `dedupeKey`.

Examples:

- `message:{conversationId}:{messageId}:{recipientUserId}`
- `task_created:{taskId}:{userId}`
- `task_application:{taskId}:{workerUserId}`
- `fund_received:{txid}:{userId}`
- `submission_approved:{submissionId}:{userId}`

The database should enforce uniqueness on `dedupeKey` when it is not null.

### Pending Transactions

Old transactions should not stay pending forever.

Rules:

- If a tx is seen on-chain with at least one confirmation, mark it `completed`.
- If a tx is broadcast but not seen after a configured timeout, mark it `failed` or keep it `pending` with a clear `lastCheckedAt`.
- Dashboard and wallet history should not infer `pending` from missing fields. They should use the transaction `status`.

### Task Reward And Fee Accounting

When a task is published:

1. Confirm employer has enough available balance.
2. Move reward amount from available to reserved.
3. Create or fund escrow.
4. Send or record platform fee.
5. Create transaction records for reward reserve and fee.
6. Mark task `open` only after the above succeeds.

When a submission is approved:

1. Release reward from reserved balance or escrow.
2. Send payout to worker wallet address.
3. Create `task_reward` transaction for worker.
4. Mark submission `paid`.
5. Mark task `completed` when appropriate.
6. Notify worker once.

### BSV Price

The task creation flow must not block forever on BSV price.

`GET /api/v1/market/bsv-price` should return:

```json
{
  "priceUsd": 50.25,
  "source": "provider-name",
  "cached": true,
  "updatedAt": "2026-06-06T12:00:00.000Z"
}
```

If live price fails, return the latest cached price with `cached: true`.

## Migration Plan

1. Build this external API and connect it to the same auth service from `AUTH_API.md`.
2. Add a BountyBee server client in the Next.js app, for example `lib/server/bountybee-api.ts`.
3. Replace local session/user lookup with external auth verification.
4. Migrate low-risk reads first: platform stats, categories, tags, marketplace task list.
5. Migrate profile, messages, and notifications.
6. Migrate wallet balance/history and paymail resolution.
7. Migrate task create/apply/submit/approve.
8. Migrate escrow, disputes, payouts, and admin.
9. Remove Prisma imports from app runtime code.
10. Remove `dev.db`, `DATABASE_URL`, and local Prisma migrations after every route uses the external API.

## Acceptance Criteria

The app is fully off `dev.db` only when all of these are true:

- `rg "@/lib/server/prisma|from .*prisma" app lib` returns no runtime Prisma imports.
- `npm run build` succeeds without `DATABASE_URL`.
- Signup stores the user only in external auth.
- Login verifies external auth and loads app user/profile from this external app API.
- Creating a task stores task data externally.
- Publishing a task records reward reserve, escrow, and fee externally.
- Approving a task pays the worker and records the payout externally.
- Wallet page loads address, paymail, balances, and history externally.
- Messages and conversations load externally.
- Notifications are created externally and deduped.
- Admin analytics and user balances are calculated externally.
- Deleting `dev.db` does not break login, tasks, wallet, messages, notifications, dashboard, or admin.
