# Shared Auth API

Use this API when another project should create/login Persona Wallet users and receive the BSV address plus encrypted wallet key.

## Server Setup

Set the same service key on the wallet server and in your second project:

```powershell
$env:AUTH_SERVICE_KEY = "change-this-long-random-secret"
$env:FLASK_SECRET_KEY = "change-this-persistent-random-secret"
python server.py
```

Every API request from the second project must include:

```http
X-Service-Key: change-this-long-random-secret
Content-Type: application/json
```

Never send a plaintext BSV private key to this server. Generate or import the BSV key in the browser/app, encrypt the WIF private key with the user's password, then send only the public `address` and `encrypted_key`.

## Signup

`POST /api/v1/auth/signup`

Request:

```json
{
  "email": "user@example.com",
  "password": "user-password",
  "address": "1BSVPublicAddress...",
  "encrypted_key": "AES-encrypted-WIF-private-key"
}
```

Response:

```json
{
  "success": true,
  "user_id": 1,
  "email": "user@example.com",
  "address": "1BSVPublicAddress...",
  "token": "session-token",
  "message": "User created in central auth DB"
}
```

## Login

`POST /api/v1/auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "user-password",
  "token": "123456"
}
```

`token` is only needed when 2FA is enabled.

Response:

```json
{
  "success": true,
  "user_id": 1,
  "email": "user@example.com",
  "address": "1BSVPublicAddress...",
  "token": "session-token",
  "token_ttl_seconds": 86400
}
```

## Verify Session

`POST /api/v1/auth/verify`

Request:

```json
{
  "token": "session-token"
}
```

Response:

```json
{
  "valid": true,
  "user_id": 1,
  "email": "user@example.com",
  "address": "1BSVPublicAddress..."
}
```

## Get Encrypted Wallet Key

`POST /api/v1/auth/wallet-key`

Request:

```json
{
  "token": "session-token"
}
```

Response:

```json
{
  "success": true,
  "user_id": 1,
  "email": "user@example.com",
  "address": "1BSVPublicAddress...",
  "encrypted_key": "AES-encrypted-WIF-private-key"
}
```

Your second project should decrypt `encrypted_key` locally with the user's password, then use the decrypted WIF private key to sign BSV messages or transactions locally.

## JavaScript Example

```js
const WALLET_API = "https://wallet.your-domain.com";
const SERVICE_KEY = process.env.AUTH_SERVICE_KEY;

async function walletSignup({ email, password, address, encryptedKey }) {
  const res = await fetch(`${WALLET_API}/api/v1/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Key": SERVICE_KEY,
    },
    body: JSON.stringify({
      email,
      password,
      address,
      encrypted_key: encryptedKey,
    }),
  });

  return res.json();
}

async function walletLogin({ email, password, totp }) {
  const res = await fetch(`${WALLET_API}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Key": SERVICE_KEY,
    },
    body: JSON.stringify({
      email,
      password,
      token: totp || undefined,
    }),
  });

  return res.json();
}

async function getEncryptedWalletKey(sessionToken) {
  const res = await fetch(`${WALLET_API}/api/v1/auth/wallet-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Key": SERVICE_KEY,
    },
    body: JSON.stringify({ token: sessionToken }),
  });

  return res.json();
}
```

