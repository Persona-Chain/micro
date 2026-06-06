# BountyBee Backend Implementation Notes

This Flask backend now stores BountyBee app data in `wallet.db` under `/api/v1/*`.

Use `AUTH_API.md` for signup/login/session tokens, then call BountyBee routes with:

```http
Authorization: Bearer external-session-token
Content-Type: application/json
```

Internal/admin event routes use:

```http
X-Service-Key: shared-long-random-secret
Content-Type: application/json
```

## Implemented Storage

- Profiles, wallets, notification preferences, and user API keys.
- Categories, tags, task drafts, task updates, marketplace listing, publishing, applications, submissions, and approval.
- Wallet balance metadata, deposit address, history, withdrawal records, client-signed withdrawal quote/broadcast placeholders, and paymail resolution.
- Conversations, messages, notifications with database-enforced `dedupe_key` uniqueness.
- Escrows, disputes, reviews, portfolio items, dashboard summaries, platform stats, leaderboard, BSV price cache, and admin summaries.

## Blockchain Signing

This backend does not decrypt or sign with BSV private keys.

Publishing and approval currently record internal accounting transactions and move stored balances. For real on-chain payouts, the second project should use the client-signed flow:

```http
POST /api/v1/wallet/withdraw/quote
POST /api/v1/wallet/withdraw/broadcast
```

The client decrypts the encrypted wallet key from `POST /api/v1/auth/wallet-key`, signs locally, then broadcasts or records the signed transaction.

