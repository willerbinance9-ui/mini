# Aare — Partner API Showcase & Documentation (Build Prompt)

Copy everything below the line into your AI builder (Cursor, v0, Bolt, etc.) to generate **Aare**, a professional developer portal and interactive showcase for the **Min / Ema Partner API**.

---

## PROMPT START

Build a complete, production-quality **single-page or multi-page web application** called **Aare** — the official developer portal for third parties who want to build their own fintech / investment apps on top of the Min platform API.

Aare is **not** the consumer app. It is a **developer-facing product**: polished documentation, live API reference, integration guides, webhook docs, and an optional **sandbox API explorer** where partners paste their API key and try endpoints safely.

### Brand & positioning

- **Product name:** Aare (pronounced like "Ah-reh")
- **Tagline:** *Build on Min. Ship your own app.*
- **Audience:** Backend engineers, fintech founders, and integration developers
- **Tone:** Professional, clear, confident — Stripe-docs quality, not startup hype
- **Visual identity:**
  - Dark-first UI with a deep navy/charcoal base (`#0B0F19`, `#111827`)
  - Accent: electric blue (`#3B82F6`) and subtle cyan highlights
  - Typography: `Inter` or `Geist` for UI, `JetBrains Mono` for code
  - Generous whitespace, sticky sidebar nav, mobile-responsive
  - Logo: wordmark **Aare** with a minimal geometric mark (abstract bridge/node — suggest SVG)

### Tech stack (use unless impossible)

- **Next.js 14+** (App Router) or **Vite + React** — TypeScript throughout
- **Tailwind CSS** + **shadcn/ui** components
- **MDX** or structured JSON for docs content (searchable)
- Static deploy target: Vercel or Netlify
- No backend required for v1 — docs are static; API explorer calls the live Min API from the browser (CORS is enabled on the platform API)

### Environment variables (for API explorer only)

```env
NEXT_PUBLIC_SITE_URL=https://aare.cc
NEXT_PUBLIC_API_BASE=https://api.aare.cc
```

**Developer portal URL:** `https://aare.cc`

Partners supply their own `ema_pk_...` key in the explorer UI (stored in `sessionStorage` only, never logged).

---

## Platform overview (document this clearly)

The **Min Partner API** is a **side system** on the same backend as the Min mobile app. It does **not** replace or break existing platform users.

| Concept | Description |
|--------|-------------|
| **Platform user** | Registered via `/auth/register`. `partner_id` is null. Uses the Min mobile app directly. |
| **Partner user** | Created only via Partner API under your `partner_id`. Isolated tenant. |
| **Partner API key** | Server-to-server credential. Format: `ema_pk_...` |
| **User session JWT** | Minted via Partner API. End users use it with standard Min user routes (`Authorization: Bearer <jwt>`). |
| **Scopes** | Each API key has granular permissions (users, wallet, deposits, etc.). |

**Production base URL:** `https://api.aare.cc`

All Partner routes are prefixed with `/v1/partner/`.

---

## Authentication

### Partner API key (server-to-server)

Send on every Partner API request using **one** of:

```http
Authorization: Bearer ema_pk_xxxxxxxx
```

```http
X-Partner-Api-Key: ema_pk_xxxxxxxx
```

Keys are shown **once** when a partner account is created (internal bootstrap). Partners must store them securely.

### User session JWT (end-user clients)

After creating a partner user, mint a session:

```http
POST /v1/partner/users/{userId}/session
Authorization: Bearer ema_pk_...
```

Response includes `token` (7-day JWT). Use it on **standard Min user endpoints** (airfarming, compliance UI routes, etc.):

```http
Authorization: Bearer <user_jwt>
```

JWT payload includes `sub` (user id) and `partner_id`.

### Scopes

| Scope | Access |
|-------|--------|
| `users` | Create/read users, mint sessions |
| `compliance` | Read/write compliance profiles |
| `wallet` | Wallet summary, whitelist addresses |
| `deposits` | Create and poll crypto deposits |
| `withdrawals` | Create and poll crypto withdrawals |
| `airfarming` | Full airfarming drop status |
| `vip` | VIP farmer summary |
| `webhooks` | Configure outbound webhooks |
| `*` | All scopes (if granted) |

Missing scope → `403 { "message": "Missing scope: <name>" }`

---

## Complete API reference (implement as interactive docs)

For **each endpoint**, document: method, path, scope, description, request body, query params, success response, error codes, and a **copy-paste curl example**. Add an **"Try it"** button in the explorer that pre-fills the request.

---

### Partner

#### `GET /v1/partner/me`

**Scope:** any valid key  
**Description:** Returns authenticated partner metadata.

**Response 200:**
```json
{
  "id": "uuid",
  "name": "Acme Fintech",
  "slug": "acme",
  "status": "active"
}
```

---

### Users

#### `POST /v1/partner/users`

**Scope:** `users`  
**Description:** Register a user under your partner tenant. Creates wallet + transfer code automatically.

**Body:**
```json
{
  "email": "user@partner.com",
  "password": "secret12",
  "externalRef": "usr_42"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| email | yes | Lowercased; unique per partner |
| password | yes | Min 6 characters |
| externalRef | no | Your stable id; unique per partner |

**Response 201:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@partner.com",
    "externalRef": "usr_42",
    "accountStatus": "active",
    "createdAt": "2026-06-08T12:00:00.000Z"
  }
}
```

#### `GET /v1/partner/users/{id}`

**Scope:** `users`  
**Description:** Lookup user by platform user id.

#### `GET /v1/partner/users?external_ref={ref}`

**Scope:** `users`  
**Description:** Lookup user by your `externalRef`.

#### `POST /v1/partner/users/{id}/session`

**Scope:** `users`  
**Description:** Mint a 7-day user JWT for client apps.

**Response 200:**
```json
{
  "token": "eyJ...",
  "user": { "id": "...", "email": "...", "externalRef": "...", "accountStatus": "active", "createdAt": "..." }
}
```

**Errors:** `403 ACCOUNT_BANNED` if user is suspended.

---

### Compliance (KYC)

#### `GET /v1/partner/users/{id}/compliance`

**Scope:** `compliance`

**Response 200:**
```json
{
  "userId": "uuid",
  "profile": { /* see fields below */ },
  "complete": true
}
```

#### `PUT /v1/partner/users/{id}/compliance`

**Scope:** `compliance`  
**Description:** Submit or update KYC. Required before withdrawals.

**Body (camelCase):**
```json
{
  "legalFirstName": "Jane",
  "legalLastName": "Doe",
  "country": "US",
  "profession": "Engineer",
  "sourceOfFunds": "employment",
  "sourceOfFundsDetail": null,
  "plannedInvestmentAmount": 5000,
  "plannedInvestmentCurrency": "usd",
  "plannedInvestmentDuration": "1_3y",
  "dateOfBirth": "1990-01-15",
  "phone": "+15551234567",
  "addressLine": "123 Main St",
  "city": "New York",
  "acceptedTerms": true
}
```

**sourceOfFunds enum:** `employment` | `business` | `savings` | `investment_returns` | `inheritance` | `other` (requires `sourceOfFundsDetail`)

**plannedInvestmentDuration enum:** `under_1y` | `1_3y` | `3_5y` | `over_5y`

---

### Wallet

#### `GET /v1/partner/users/{id}/wallet`

**Scope:** `wallet`  
**Description:** Balances, activity timeline, max withdrawable USDT, deposit/payout history.

**Response 200 (abbreviated):**
```json
{
  "userId": "uuid",
  "balances": [{ "asset": "usdttrc20", "available": 100.5 }],
  "cashWalletUsd": 0,
  "maxWithdrawableUsdt": 95.475,
  "cashFundsCryptoWithdrawals": true,
  "activity": [],
  "payments": [],
  "payouts": [],
  "configured": true,
  "payoutConfigured": true
}
```

---

### Deposits (crypto via AarePaymentApi)

#### `POST /v1/partner/users/{id}/deposits`

**Scope:** `deposits`  
**Description:** Create a crypto deposit invoice. User sends crypto to `payAddress`.

**Body:**
```json
{
  "priceAmount": 100,
  "priceCurrency": "usd",
  "payCurrency": "usdttrc20"
}
```

**Response 201:**
```json
{
  "userId": "uuid",
  "deposit": {
    "id": "uuid",
    "paymentId": "12345",
    "orderId": "ema-...",
    "status": "waiting",
    "payAddress": "T...",
    "payAmount": "100.5",
    "payCurrency": "usdttrc20",
    "priceAmount": 100,
    "priceCurrency": "usd",
    "ledgerCredited": false,
    "createdAt": "..."
  },
  "expirationEstimateDate": "..."
}
```

#### `GET /v1/partner/users/{id}/deposits`

**Scope:** `deposits`  
**Query:** `limit` (1–50, default 20)

#### `GET /v1/partner/users/{id}/deposits/{depositId}`

**Scope:** `deposits`  
**Description:** Poll until `ledgerCredited: true` or terminal failure.

---

### Withdrawals (crypto)

**Prerequisites:** compliance complete + whitelisted payout address.

#### `POST /v1/partner/users/{id}/whitelist-wallets`

**Scope:** `wallet`

**Body:**
```json
{
  "currency": "usdttrc20",
  "address": "TYourTronAddress...",
  "label": "Main wallet"
}
```

#### `GET /v1/partner/users/{id}/whitelist-wallets`

**Scope:** `wallet`

#### `DELETE /v1/partner/users/{id}/whitelist-wallets/{walletId}`

**Scope:** `wallet`

#### `POST /v1/partner/users/{id}/withdrawals`

**Scope:** `withdrawals`  
**Description:** Submit withdrawal. Partner API skips user TOTP; compliance + whitelist still required. Goes through admin approval like the main app.

**Body:**
```json
{
  "currency": "usdttrc20",
  "address": "TYourTronAddress...",
  "amount": 50
}
```

**Response 201:**
```json
{
  "userId": "uuid",
  "withdrawal": {
    "id": "uuid",
    "status": "pending",
    "currency": "usdttrc20",
    "address": "T...",
    "amount": 50,
    "cashFunded": 0,
    "createdAt": "..."
  },
  "message": "Withdrawal submitted for processing."
}
```

**Errors:**
- `403 COMPLIANCE_PROFILE_REQUIRED`
- `400 WALLET_NOT_WHITELISTED`
- `400` insufficient balance (includes `maxWithdrawable`, `available`)

#### `GET /v1/partner/users/{id}/withdrawals`

**Scope:** `withdrawals`  
**Query:** `limit` (1–50)

#### `GET /v1/partner/users/{id}/withdrawals/{withdrawalId}`

**Scope:** `withdrawals`

---

### Airfarming

#### `GET /v1/partner/users/{id}/airfarming/status`

**Scope:** `airfarming`  
**Alias:** `GET /v1/partner/users/{id}/airfarming`

**Description:** Full drop schedule — same payload as the Min app `/airfarming/status`: `cashWallet`, `airfarmingBalance`, `nextDrop`, `upcomingDrops`, `history`, `withdrawalTrustScore`, etc.

---

### VIP Farmers

#### `GET /v1/partner/users/{id}/vip`

**Scope:** `vip`  
**Description:** VIP farmer investment summary for the user.

---

### Webhooks (outbound callbacks)

Partners receive HTTPS POST callbacks when events occur for **partner users only**.

#### `GET /v1/partner/webhooks`

**Scope:** `webhooks`

#### `PUT /v1/partner/webhooks`

**Scope:** `webhooks`

**Body:**
```json
{
  "url": "https://your-app.com/ema/webhooks",
  "enabled": true,
  "events": ["deposit.credited", "withdrawal.finished"],
  "rotateSecret": false
}
```

On first enable or `rotateSecret: true`, response includes `secret` (shown once):
```json
{
  "url": "https://...",
  "enabled": true,
  "events": ["deposit.credited", "withdrawal.finished"],
  "hasSecret": true,
  "secretPreview": "••••••••ab12",
  "secret": "ema_whsec_...",
  "warning": "Store webhook secret securely; it is shown only when created or rotated."
}
```

#### `POST /v1/partner/webhooks/test`

**Scope:** `webhooks`  
Sends a `webhook.test` event to your configured URL.

#### Webhook delivery format

**Headers:**
```
Content-Type: application/json
X-Ema-Event: deposit.credited
X-Ema-Delivery-Id: uuid
X-Ema-Timestamp: 2026-06-08T12:00:00.000Z
X-Ema-Signature: sha256=<hmac-sha256-hex of raw body>
User-Agent: Ema-Partner-Webhooks/1.0
```

**Body:**
```json
{
  "id": "delivery-uuid",
  "type": "deposit.credited",
  "createdAt": "2026-06-08T12:00:00.000Z",
  "partnerId": "partner-uuid",
  "data": {
    "userId": "uuid",
    "externalRef": "usr_42",
    "depositId": "uuid",
    "paymentId": "12345",
    "orderId": "ema-...",
    "amount": 100.5,
    "asset": "usdttrc20",
    "priceAmount": 100,
    "priceCurrency": "usd",
    "creditedAt": "2026-06-08T12:00:00.000Z"
  }
}
```

**`withdrawal.finished` data:**
```json
{
  "userId": "uuid",
  "externalRef": "usr_42",
  "withdrawalId": "uuid",
  "payoutId": "np-id",
  "amount": 50,
  "currency": "usdttrc20",
  "address": "T...",
  "status": "finished",
  "finishedAt": "2026-06-08T12:00:00.000Z"
}
```

**Signature verification (Node.js example — show in docs):**
```javascript
const crypto = require('crypto');

function verifyEmaWebhook(rawBody, signatureHeader, secret) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
}
```

**Idempotency:** Duplicate events for the same `(partner, event, source_id)` are not re-sent.

---

## Integration guides (dedicated doc pages)

Create step-by-step guides with Mermaid sequence diagrams:

### Guide 1: Quickstart (5 minutes)

1. Obtain partner API key (`ema_pk_...`) from Min platform ops
2. `GET /v1/partner/me` — verify key
3. `POST /v1/partner/users` — create test user
4. `POST /v1/partner/users/{id}/session` — get user JWT
5. Link to full flows

### Guide 2: Deposit flow

```
Partner backend → POST /deposits → show payAddress to user
User sends crypto on-chain
Partner polls GET /deposits/{id} OR receives webhook deposit.credited
```

### Guide 3: Withdrawal flow

```
PUT /compliance → POST /whitelist-wallets → POST /withdrawals
Poll GET /withdrawals/{id} OR webhook withdrawal.finished
```

### Guide 4: Embedding Min products in your app

- **Option A (headless):** Partner backend calls Partner API; your UI is fully custom
- **Option B (hybrid):** Mint user JWT → call standard Min user routes from your mobile/web client
- Document key user routes partners can call with the minted JWT:
  - `GET /airfarming/status`
  - `GET /compliance/profile`
  - `GET /nowpayments/summary`
  - `GET /vip-farmers/summary`

### Guide 5: Webhooks setup

Configure URL → store secret → verify signatures → handle idempotent processing → test endpoint.

---

## Error reference page

| HTTP | Code | Meaning |
|------|------|---------|
| 400 | — | Validation failed |
| 401 | — | Missing/invalid API key |
| 403 | `ACCOUNT_BANNED` | User suspended |
| 403 | `COMPLIANCE_PROFILE_REQUIRED` | KYC incomplete |
| 403 | `Missing scope: X` | API key lacks permission |
| 400 | `WALLET_NOT_WHITELISTED` | Address not saved |
| 400 | `WHITELIST_WALLET_LIMIT` | Max whitelist reached |
| 400 | `WHITELIST_WALLET_DUPLICATE` | Address already saved |
| 404 | — | User/deposit/withdrawal not found |
| 503 | — | Schema/service not configured |

---

## Site structure (build all pages)

```
/                     → Hero + value prop + "Get started" CTA
/docs                 → Documentation home (sidebar layout)
/docs/quickstart      → 5-minute integration
/docs/authentication  → API keys, scopes, user JWT
/docs/users           → User endpoints
/docs/compliance      → KYC fields + enums
/docs/wallet          → Balances + whitelist
/docs/deposits        → Crypto deposit flow
/docs/withdrawals     → Withdrawal flow + prerequisites
/docs/airfarming      → Drops product overview
/docs/vip             → VIP farmers overview
/docs/webhooks        → Events, signatures, examples
/docs/errors          → Error codes
/docs/api-reference   → Full searchable endpoint list
/explorer             → Interactive API playground
/changelog            → API version notes (v1 initial release)
```

### Hero section copy (use or refine)

> **Aare** is the developer home for building on Min. Register users, move funds, run airfarming drops, and receive real-time webhooks — without rebuilding custody, compliance, or payout infrastructure.

### Required UI components

1. **Sticky docs sidebar** with section groups and active link highlighting
2. **Code blocks** with language tabs (curl, JavaScript, Python) and one-click copy
3. **Endpoint cards** — method badge (GET=blue, POST=green, PUT=amber, DELETE=red), path, scope chips
4. **API Explorer panel:**
   - Input: API base URL (default production), API key (password field)
   - Dropdown: pick endpoint → auto-fill method, path, body template
   - Path param inputs (`userId`, `depositId`, etc.)
   - "Send request" → show status, headers, JSON response
   - Save last 10 requests in session
5. **Mermaid diagrams** for deposit, withdrawal, and webhook flows
6. **Search** across all docs (⌘K command palette)
7. **Dark/light mode** toggle
8. **Footer:** "Powered by Min Platform" · API status link · Contact/partner onboarding CTA

### Professional documentation standards

- Every endpoint must have **at least one working curl example** using `https://api.aare.cc`
- Use **consistent terminology** (partner user, platform user, externalRef, scope)
- Include **security section:** never expose `ema_pk_` in client-side mobile apps; use server-side proxy; store webhook secrets in env vars
- Include **rate limiting note:** "Fair use expected; contact Min for production volume"
- Add **OpenAPI-style grouping** even if you don't generate openapi.json in v1
- Write for developers who have **never seen Min** — explain products in one sentence each:
  - **Airfarming:** scheduled yield drops funded from user balance
  - **VIP Farmers:** locked-term investment product
  - **Wallet:** USDT crypto ledger + USD cash wallet (combined withdrawable)

### Sandbox / demo mode (optional enhancement)

If no API key is provided, show **read-only docs** with **mock JSON responses** in the explorer (toggle: "Live" vs "Mock"). Mock data should match real response shapes exactly.

### Accessibility & quality bar

- WCAG 2.1 AA contrast
- Keyboard-navigable sidebar and explorer
- `aria-label` on copy buttons
- Lighthouse score target: 90+ performance, 100 accessibility (docs pages)
- No lorem ipsum — all content must be real API documentation

### Deliverables

1. Full source code for the Aare webapp
2. README with local dev instructions (`npm install && npm run dev`)
3. All documentation pages populated with the API reference above
4. Working API explorer (live mode against `NEXT_PUBLIC_API_BASE`)
5. Responsive layout — usable on iPad and desktop (mobile: collapsed sidebar)

Do **not** build a partner onboarding backend — document that API keys are issued by Min platform operations via internal bootstrap. Show a "Request API access" mailto or link placeholder.

Build Aare as a polished, shippable developer portal that makes developers excited to integrate Min — clarity and completeness matter more than flashy animations.

## PROMPT END
