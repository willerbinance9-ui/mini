# Airfarms — Deployment Guide

Production deployment for the **Airfarms** (Ema) monorepo: Express API on Render, Supabase Postgres, Expo EAS preview APK.

## Repository layout

| Path | Purpose |
|------|---------|
| `backend/` | Express 5 API, admin console (`public/admin/`), SQL migrations |
| `ema-mobile/` | Expo SDK 54 app (`AirFarmerPro`) |
| `render.yaml` | Render web service blueprint (root dir `backend`) |

## 1. Supabase database

1. Create a Supabase project.
2. In the SQL editor, run in order:
   - `backend/sql/schema.sql`
   - Every file in `backend/sql/migrations/` sorted by filename (e.g. `20260509_totp.sql` … `20260609_crypto_ledger_admin_adjustment.sql`)
3. Confirm seed data: `airfarming_drop_bands` (4 bands), `airfarming_platform_settings`.

Legacy one-off files (`migrate_airfarming_contracts.sql`, `migrate_va_to_onchain.sql`) are for existing deployments only — skip on a fresh project if migrations already cover those changes.

## 2. Backend (Render)

1. Connect repo; set **Root Directory** to `backend`.
2. **Build:** `npm install` · **Start:** `npm start` · **Health check:** `/health`
3. Set environment variables (see `backend/.env.example`).

Required:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `APP_BASE_URL` (public Render URL, used in webhooks)

Production:

- `ADMIN_USERNAME`, `ADMIN_PASSWORD`
- `TOTP_ENCRYPTION_KEY` (32 bytes hex: `openssl rand -hex 32`)
- `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`
- `INTERNAL_CRON_SECRET`
- `DEEPSEEK_API_KEY` (AI daily earnings planner)

Optional integrations: Tatum, Flutterwave, MetaApi (`MT5_METAAPI_TOKEN`), SMTP email, `MT5_EA_WEBHOOK_SECRET`, `MT5_PRICE_FEED_SECRET`, `MT5_LIVE_SERVER`.

### Admin console

Open `https://<your-api>/admin` — login via `POST /admin/api/login`.

### Cron jobs

Schedule HTTP POST with header `x-internal-cron-secret: <INTERNAL_CRON_SECRET>`:

| Endpoint | Schedule (UTC) |
|----------|----------------|
| `POST /internal/vip-farmers/daily-accrue` | Daily |
| `POST /internal/contracts/daily-accrue` | Daily |
| `POST /internal/ai/daily-plan` | Daily (optional) |

Airfarming drop settlement is **not** cron-driven — it runs on `GET /airfarming/status` polls.

### Webhooks (configure at providers)

| Path | Provider |
|------|----------|
| `POST /webhooks/nowpayments/payment` | NOWPayments deposit IPN |
| `POST /webhooks/nowpayments/payout` | NOWPayments payout IPN |
| `POST /webhooks/flutterwave` | Flutterwave mobile money |
| `POST /crypto/webhooks/tatum` | Tatum Ethereum |
| `POST /webhooks/mt5-ea/telemetry` | MT5 EA |
| `POST /webhooks/mt5-ea/prices` | MT5 price feed EA |

Base URL must match `APP_BASE_URL`.

### Live trading (MT5 server)

1. Run migration `backend/sql/migrations/20260614_live_trading_accounts.sql`.
2. Set env: `MT5_LIVE_SERVER` (server name shown to users), `MT5_PRICE_FEED_SECRET` (64+ char hex), `MT5_METAAPI_TOKEN`.
3. On your MT5 VPS terminal:
   - **Tools → Options → Expert Advisors → Allow WebRequest** — add your API host (e.g. `https://mini-rdjs.onrender.com`).
   - Compile and attach **`backend/docs/EmaPriceFeedEa.mq5`** to any chart; set `InpApiBase` and `InpPriceFeedSecret`.
   - Attach **`backend/docs/EmaWebhookEa.mq5`** per trading account for telemetry + command execution.
4. Ensure symbols are in **Market Watch** for the price feed EA.

## 3. Mobile (EAS preview APK)

```bash
cd ema-mobile
cp .env.example .env   # set EXPO_PUBLIC_API_URL to your Render URL
npm install
eas build --profile preview --platform android
```

`eas.json` preview profile builds an APK with `EXPO_PUBLIC_API_URL`. Update that URL before production builds.

Local dev:

- Emulator Android: `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000`
- Physical device (same Wi‑Fi): `http://<LAN_IP>:4000`

## 4. Local development

```bash
# Terminal 1 — API
cd backend && cp .env.example .env && npm install && npm run dev

# Terminal 2 — Mobile
cd ema-mobile && cp .env.example .env && npm install && npm start
```

## 5. MVP verification checklist

- [ ] Register, login, TOTP, compliance profile
- [ ] Cash + crypto (NOWPayments) deposit/withdraw with whitelist + gas reserve
- [ ] Airfarming: activate, auto-fund, 3-step progress, drop settlement
- [ ] VIP: invest, add capital, early/mature withdraw; daily accrual cron
- [ ] Contracts, Expert, Trades hub hide/show, P2P, journal
- [ ] Admin: users, VIP column, wallet adjust, withdrawals, drops, tiers, notify

## GitHub repository

- **Deploy from:** [github.com/willerbinance9-ui/mini](https://github.com/willerbinance9-ui/mini)

## Reference

- Upstream fork: [willerdev/ema](https://github.com/willerdev/ema)
- MT5 EA source: `backend/docs/EmaWebhookEa.mq5`, `backend/docs/EmaPriceFeedEa.mq5`
- NOWPayments notes: `backend/docs/NOWPAYMENTS.md`
