# External Auth and BSV Wallet Address Rules

Based on `EGGWALLET_CENTRAL_API.md`, external auth should not be changed to make the auth/user address a BSV address.

The correct rule is:

- `HATCH` is canonical from Webwallet auth.
- `BSV` is canonical from Eggwallet wallet storage.
- BountyBee must use `wallets/BSV`, not the auth/Hatch address, for deposit/profile/withdraw wallet behavior.

## What BountyBee Should Use

Use the authenticated central wallet endpoints for the BSV wallet:

```text
GET /api/v1/wallets
GET /api/v1/wallets/BSV
PUT /api/v1/wallets/BSV
```

Expected BSV wallet shape:

```json
{
  "success": true,
  "wallet": {
    "address": "1BsvAddress...",
    "encrypted_key": "encrypted-key-if-present",
    "source": "eggwallet"
  }
}
```

BountyBee user sync should send the BSV wallet address:

```text
POST /api/v1/users/sync
```

```json
{
  "username": "alice",
  "displayName": "Alice",
  "address": "1BsvAddress...",
  "publicKey": "optional-public-key"
}
```

Do not send the Hatch/auth address as BountyBee's profile or deposit wallet address.

## External Auth Behavior

External auth can continue returning the auth/Hatch address from:

```text
POST /api/v1/auth/login
POST /api/v1/auth/verify
POST /api/v1/auth/wallet-key
```

That address should be treated as a Hatch/auth identity address unless the backend explicitly says it is the BSV wallet.

For BountyBee login, the app should:

1. Log in through external auth and receive the session token.
2. Load `GET /api/v1/wallets` and read the `BSV` entry.
3. If the wallet list succeeds but no BSV wallet exists, create or save one with `PUT /api/v1/wallets/BSV`.
4. If `wallets.BSV.address` equals `wallets.HATCH.address` or the auth/login address, treat `BSV` as incorrectly seeded from Hatch, generate a new BSV wallet, and save it with `PUT /api/v1/wallets/BSV`.
5. Sync the user with `/api/v1/users/sync` using the BSV address.

BountyBee should not use `/api/v1/auth/wallet-key` to derive its BSV wallet. That endpoint belongs to the auth/Hatch identity flow unless the external backend explicitly documents otherwise.

## BSV Wallet Creation

When BountyBee generates a BSV keypair, save it through:

```text
PUT /api/v1/wallets/BSV
```

```json
{
  "address": "1BsvAddress...",
  "encrypted_key": "pbe:v1:...",
  "source": "eggwallet"
}
```

If `encrypted_key` is omitted, Webwallet preserves the existing encrypted key in `wallet.db`, so address-only syncs should not erase encrypted key blobs.

## Withdrawal Validation

BountyBee withdrawals should accept only BSV on-chain addresses.

Reject:

```text
user@bountybee.io
bc1q...
bitcoincash:...
qpm2...
HatchAddress...
```

Invalid withdrawal destinations should return a clear `400` error:

```json
{
  "success": false,
  "message": "Enter a valid on-chain BSV address. Paymail, CashAddr, BTC SegWit, and Hatch addresses are not accepted."
}
```

## Current App Alignment

The current app uses central wallet storage in `lib/server/external-auth.ts` for BSV wallet lookup and upsert.

On login, the app now:

1. Authenticates with `/api/v1/auth/login`.
2. Reads Eggwallet's BSV address from the `BSV` entry returned by `/api/v1/wallets`.
3. Compares `wallets.BSV.address` against `wallets.HATCH.address` and the auth/login address.
4. Creates and saves a new BSV wallet if the central wallet list succeeds and has no `BSV` address, or if `BSV` was incorrectly seeded with the Hatch/auth address.
5. Uses the final BSV address for `/api/v1/users/sync`.

It does not fall back to the auth/Hatch address or auth wallet key for BountyBee's BSV wallet address.

The important backend requirement is to keep Hatch/auth address and BSV wallet address separate:

- Hatch/auth address: identity/auth.
- BSV address: BountyBee wallet, profile wallet, deposits, withdrawals, and BSV user sync.
