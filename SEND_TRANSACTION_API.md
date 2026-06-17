# Send Transaction API

This file explains how to call Eggwallet's transaction send APIs and how private-key signing is handled.

## Authentication

All local send endpoints require a logged-in Eggwallet session.

From browser code, include cookies:

```js
fetch('/api/send', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
```

If you call from another backend, forward the authenticated Eggwallet session cookie or bearer token used by the app.

## Send BTC, BSV, or BCH From Eggwallet DB

Use this endpoint when you want to send `BTC`, `BSV`, or `BCH` using the private key already stored in Eggwallet for the logged-in user.

The API caller should not send the private key. Eggwallet reads the WIF from:

1. The current connected wallet session.
2. The logged-in user's stored wallet record, for example `users[user].addresses.BSV.wif`.

```http
POST /api/send
Content-Type: application/json
```

`POST /api/send/` is also accepted for clients that automatically append a trailing slash.

Request body:

```json
{
  "symbol": "BSV",
  "address": "destination_address_here",
  "amount": "0.001"
}
```

For BSV, Eggwallet signs with the stored BSV WIF from its wallet data.

Supported symbols:

- `BSV`
- `BTC`
- `BCH`
- `HATCH`

For `BTC`, `BSV`, and `BCH`, `/api/send` signs on the backend with the stored WIF for the current session/user. A request-provided `private_key_wif` is only a fallback for development or migration cases where the stored wallet record has no WIF.

Success response:

```json
{
  "success": true,
  "txid": "transaction_id_here"
}
```

Example:

```js
async function sendCoin() {
  const res = await fetch('/api/send', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      symbol: 'BSV',
      address: '1DestinationAddress...',
      amount: '0.001'
    })
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.detail || data.error || 'Send failed');
  }
  return data.txid;
}
```

## Send HATCH With Private Key Signing

Use this endpoint when you need to provide the HATCH private key WIF at send time.

```http
POST /api/hatch/send
Content-Type: application/json
```

`POST /api/hatch/send/` is also accepted for clients that automatically append a trailing slash.

Request body:

```json
{
  "to_address": "destination_hatch_address_here",
  "amount": "1.25",
  "private_key_wif": "sender_private_key_wif_here"
}
```

The backend resolves the sender `from_address` from the logged-in user's stored HATCH address, then forwards this payload to the configured transaction signer:

```json
{
  "from_address": "current_user_hatch_address",
  "to_address": "destination_hatch_address_here",
  "amount": 1.25,
  "private_key_wif": "sender_private_key_wif_here"
}
```

Success response:

```json
{
  "success": true,
  "txid": "transaction_id_here"
}
```

Example:

```js
async function sendHatchWithPrivateKey({ toAddress, amount, privateKeyWif }) {
  const res = await fetch('/api/hatch/send', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to_address: toAddress,
      amount: String(amount),
      private_key_wif: privateKeyWif
    })
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || 'HATCH send failed');
  }
  return data.txid;
}
```

## Internal Signer API

Eggwallet forwards HATCH sends to:

```http
POST {HATCH_SEND_URL}
```

If `HATCH_SEND_URL` is not set, it defaults to:

```http
POST {AUTH_BASE_URL}/send-transaction
```

Internal request headers:

```http
X-Service-Key: your_auth_service_key
Content-Type: application/json
Accept: application/json
```

Internal request body:

```json
{
  "from_address": "sender_hatch_address",
  "to_address": "destination_hatch_address",
  "amount": 1.25,
  "private_key_wif": "sender_private_key_wif"
}
```

This internal signer endpoint should only be called from trusted backend code, because it receives the private key WIF.

## Common Errors

`401`:

```json
{ "error": "not logged in" }
```

`400`:

```json
{ "error": "amount must be greater than 0" }
```

`400`:

```json
{ "error": "wallet not connected (missing WIF)" }
```

This means Eggwallet could not find a stored WIF for the requested symbol, such as `BSV`, under the logged-in user wallet data. The wallet record must include both the address and its matching WIF before the backend can sign automatically.

`400`:

```json
{ "error": "private_key_wif is required" }
```

This applies to `/api/hatch/send`, not the normal BSV `/api/send` flow.

`500`:

```json
{ "error": "AUTH_SERVICE_KEY is not configured on the backend." }
```

## Security Notes

- Always call these APIs over HTTPS in production.
- Never log `private_key_wif`.
- Never store plaintext private keys in localStorage.
- Prefer decrypting the user's encrypted key in memory only, sending it once, then clearing the variable.
- For stronger security, sign transactions client-side and send only the raw signed transaction to a broadcast endpoint. The current HATCH API signs through the configured backend signer.
