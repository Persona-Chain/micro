# Eggwallet Central Wallet DB API

This document describes the Eggwallet functions now integrated through Webwallet's central `wallet.db`.

Eggwallet keeps its existing local browser routes, but those routes now call Webwallet's authenticated `/api/v1/*` API through Eggwallet's `/api/app/*` proxy or backend helpers.

## Required Headers

Server-to-server requests must include:

```http
X-Service-Key: your-shared-service-key
Content-Type: application/json
```

Authenticated app-data requests must also include:

```http
Authorization: Bearer session-token
```

The session token is returned by `/api/v1/auth/login` or `/api/v1/auth/signup`.

## Wallet Storage

Supported symbols:

- `HATCH`
- `BSV`
- `BTC`
- `BCH`

### List Wallets

`GET /api/v1/wallets`

Returns all stored wallet records for the authenticated user.

```json
{
  "success": true,
  "wallets": {
    "BSV": {
      "address": "1BsvAddress...",
      "encrypted_key": "encrypted-key-if-present",
      "source": "eggwallet"
    },
    "HATCH": {
      "address": "HatchAddress...",
      "encrypted_key": null,
      "source": "auth_api"
    }
  }
}
```

### Get Wallet

`GET /api/v1/wallets/:symbol`

Example:

```http
GET /api/v1/wallets/BSV
```

### Upsert Wallet

`PUT /api/v1/wallets/:symbol`

```json
{
  "address": "1BsvAddress...",
  "encrypted_key": "encrypted-key-if-available",
  "source": "eggwallet"
}
```

If `encrypted_key` is omitted, Webwallet preserves the existing encrypted key in `wallet.db`.

### Delete Wallet

`DELETE /api/v1/wallets/:symbol`

Deletes the symbol wallet for the authenticated user.

## Eggwallet App State

### Get State

`GET /api/v1/apps/eggwallet/state`

### Replace State

`PUT /api/v1/apps/eggwallet/state`

```json
{
  "state": {
    "notifications": [],
    "posts": [],
    "uploaded_images": [],
    "connections": [],
    "soulrank": {
      "points": 10000,
      "ledger": [],
      "connected_projects": []
    }
  }
}
```

### Patch State

`PATCH /api/v1/apps/eggwallet/state`

```json
{
  "set": {
    "profile.theme": "dark"
  },
  "append": {
    "posts": {
      "id": "post_123",
      "text": "Hello"
    }
  }
}
```

## SoulRank

Eggwallet local routes now proxy to these central routes:

- `/api/soulrank` -> `GET /api/v1/soulrank`
- `/api/soulrank/ledger` -> `GET /api/v1/soulrank/ledger`
- `/api/soulrank/spend` -> `POST /api/v1/soulrank/spend`
- `/api/soulrank/credit` -> `POST /api/v1/soulrank/credit`
- `/api/soulrank/projects` -> `GET /api/v1/soulrank/projects`
- `/api/soulrank/projects/connect` -> `POST /api/v1/soulrank/projects/connect`

### Spend Points

`POST /api/v1/soulrank/spend`

```json
{
  "amount": 50,
  "action": "feed",
  "source_project": "eggwallet",
  "reference_id": "egg_123",
  "note": "Fed egg",
  "metadata": {}
}
```

If the user does not have enough points, the API returns an error with current `points` and `required`.

### Credit Points

`POST /api/v1/soulrank/credit`

```json
{
  "amount": 100,
  "action": "reward",
  "source_project": "eggwallet",
  "reference_id": "reward_123",
  "metadata": {}
}
```

## Connections

Eggwallet local routes now proxy to these central routes:

- `/api/track-connection` -> `POST /api/v1/connections`
- `/api/connections` -> `GET /api/v1/connections`

### Create Connection

`POST /api/v1/connections`

```json
{
  "device_id": "browser-device-id",
  "device_name": "Desktop Browser",
  "tz": "Europe/Paris",
  "locale": "en-US",
  "metadata": {}
}
```

## User Sync

Eggwallet syncs the local app profile through:

`POST /api/v1/users/sync`

```json
{
  "username": "alice",
  "displayName": "Alice",
  "address": "1BsvAddress...",
  "publicKey": "optional-public-key"
}
```

For BountyBee and other BSV apps, `address` should be the BSV address from `external_wallets.BSV`.

For Hatch, use the auth/user address or `wallets/HATCH`.

## Address Source Rules

- `HATCH` address is canonical from Webwallet auth.
- `BSV` address is canonical from Eggwallet and stored in `external_wallets` with symbol `BSV`.
- BountyBee deposit/profile wallet address should use `BSV`, not the auth/Hatch address.
- Address-only syncs do not erase existing encrypted key blobs.
