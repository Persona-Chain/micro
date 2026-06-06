# BSV Signing Recommendation

## Recommendation

Use a client-signed transaction flow for BountyBee payouts.

The backend should store app data, balances, escrows, task state, and transaction records. It should not store or decrypt plaintext BSV private keys.

## Why

Real BSV transactions require a private key signature. If this backend signs transactions directly, it must access private keys or decrypted wallet keys. That makes the backend custodial and creates a major security risk:

- A database leak can expose spendable funds if keys are stored badly.
- A server compromise can drain user wallets.
- Backend bugs can accidentally sign the wrong payout.
- Users must trust the server with full spending power.

The safer design is non-custodial:

- The backend stores only public addresses and encrypted wallet-key blobs.
- The user password decrypts the wallet key only on the client.
- The client signs the transaction locally.
- The backend verifies, broadcasts, and records the result.

## Suggested Flow

### 1. Task Publish

When an employer publishes a task:

1. Backend checks available backend balance.
2. Backend reserves the task reward.
3. Backend creates an escrow row.
4. Backend records platform fee and escrow funding transactions.
5. Task becomes `open`.

This is backend accounting. If the funds are already deposited into a platform escrow wallet, this is enough for app state.

### 2. Submission Approval

When the employer approves a worker submission:

1. Backend marks the submission ready for payout.
2. Backend creates a payout quote.
3. Client fetches encrypted wallet key from `/api/v1/auth/wallet-key`.
4. Client decrypts the key locally with the user password.
5. Client signs the payout transaction locally.
6. Client sends signed transaction to backend.
7. Backend broadcasts or records the signed transaction.
8. Backend marks submission `paid` only after broadcast succeeds.

## Required API Work

### Quote Route

```http
POST /api/v1/wallet/withdraw/quote
Authorization: Bearer external-session-token
```

Request:

```json
{
  "to": "1WorkerAddress...",
  "amount": 95000,
  "taskId": 20,
  "submissionId": 1
}
```

Response:

```json
{
  "success": true,
  "quote": {
    "to": "1WorkerAddress...",
    "amount": 95000,
    "fee": 120,
    "unsignedTx": "unsigned-transaction-data",
    "expiresAt": "2026-06-06T12:10:00.000Z",
    "signingRequired": true
  }
}
```

### Broadcast Route

```http
POST /api/v1/wallet/withdraw/broadcast
Authorization: Bearer external-session-token
```

Request:

```json
{
  "signedTx": "signed-raw-transaction",
  "taskId": 20,
  "submissionId": 1
}
```

Response:

```json
{
  "success": true,
  "txid": "worker-payout-txid",
  "status": "pending"
}
```

## Backend Rules

- Never accept plaintext private keys.
- Never return plaintext private keys.
- Store only encrypted wallet-key blobs.
- Mark payouts as `paid` only after signed transaction broadcast succeeds.
- Keep transaction status explicit: `pending`, `completed`, `failed`, or `cancelled`.
- Use satoshis for all amounts.
- Add idempotency/dedupe keys for payout actions.

## Future Option

If BountyBee later needs automatic payouts without user interaction, use a dedicated secure signing service instead of putting keys directly in this Flask backend.

Good options:

- Hardware security module
- Cloud KMS-backed signing service
- Multisig escrow wallet
- Separate audited wallet microservice

That would make the system custodial or semi-custodial, so it should be added only after deciding the legal, security, and operational responsibilities are acceptable.

