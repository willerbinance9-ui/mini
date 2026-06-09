# Aare

Developer portal and API explorer for the **Min Partner API**.

## Local development

```bash
cd aare-web
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE` | Min API base URL (default: `https://api.aare.cc`) |
| `NEXT_PUBLIC_SANDBOX_API_BASE` | Optional separate sandbox API URL (shown in docs) |
| `NEXT_PUBLIC_SITE_URL` | Public site URL (default: `https://aare.cc`) |

## Deploy

Deploy to Vercel or Netlify as a static/SSR Next.js app. Point the custom domain **`aare.cc`** at the deployment.

Production env:

```env
NEXT_PUBLIC_SITE_URL=https://aare.cc
NEXT_PUBLIC_API_BASE=https://api.aare.cc
```

Point `aare.cc` at the portal and `api.aare.cc` at your Render backend (CNAME).

## Structure

- `/` — Marketing home
- `/services` — Income programs (live trading, airfarming, ghost, VIP)
- `/compare` — Service comparison table
- `/pricing` — Partnership pricing & commission
- `/signup`, `/login` — Partner portal accounts
- `/dashboard` — Application status, API users, keys, balances (after approval)
- `/docs` — Documentation with sidebar
- `/explorer` — Live API playground
- `/webhooks/playground` — HMAC signature tool
- `/openapi` — OpenAPI 3.1 JSON
- `/postman-collection.json` — Postman import
- `/partnership` — Application form
- `/case-studies`, `/security`, `/status` — Trust & ops pages
- `/changelog` — API version history

## Examples

```bash
API_BASE=https://api.aare.cc PARTNER_API_KEY=ema_pk_... node examples/hello-partner/index.mjs
```

Partner API keys are **not** stored server-side; the explorer and dashboard keep keys in `sessionStorage` only.
