# Airfarms (Ema) — Fintech Mobile + API

**Min** is a production-grade fintech stack: Expo React Native mobile app, Node.js Express API, Supabase Postgres, and a static admin console. Users manage crypto (USDT via NOWPayments), Airfarming yield drops, VIP Farmers, Expert MT5 trading, P2P transfers, and local-money rails.

## Repository layout

```
├── backend/          Express 5 API, admin UI, SQL migrations
├── ema-mobile/       Expo SDK 54 (package: AirFarmerPro)
├── docs/             Deployment and ops notes
└── render.yaml       Render blueprint (backend root dir)
```

## Tech stack

| Layer | Stack |
|-------|--------|
| Mobile | Expo ~54, React 19, React Navigation 7, Zustand, dark theme |
| API | Express 5, JWT + bcrypt, Supabase service role |
| DB | Supabase PostgreSQL |
| Crypto | NOWPayments, Tatum (ETH), on-chain ledger |
| Admin | Vanilla JS SPA at `/admin` |

## Quick start

### Database

Apply `backend/sql/schema.sql`, then all files in `backend/sql/migrations/` in filename order. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Backend

```bash
cd backend
cp .env.example .env   # fill Supabase + JWT_SECRET
npm install
npm run dev            # http://localhost:4000
```

Health: `GET /health` · Admin UI: `http://localhost:4000/admin`

### Mobile

```bash
cd ema-mobile
cp .env.example .env   # EXPO_PUBLIC_API_URL → backend URL
npm install
npm start
```

## Core products

| Product | Mobile screen | API prefix |
|---------|---------------|------------|
| Cash + crypto wallet | `WalletScreen` | `/wallet`, `/nowpayments` |
| Airfarming (drops) | `AirfarmingTradeScreen` | `/airfarming` |
| VIP Farmers | `VipFarmersTradeScreen` | `/vip-farmers` |
| Expert / MT5 | `ExpertAutoTradingScreen`, `MT5Screen` | `/expert`, `/mt5` |
| P2P, local money, journal | Extra tab | `/wallet/transfer`, `/local-money`, `/journal` |

## Security

- JWT on protected routes; separate admin JWT (`/admin/api/login`)
- TOTP (Google Authenticator) with encrypted secrets at rest
- Compliance profile required before withdrawals
- Crypto: 5% gas reserve, whitelisted addresses (max 3), TOTP on withdraw
- Airfarming: 24h eligibility snapshot anti-gaming; withdrawal trust score affects drop multiplier

## Deployment

- **API:** Render — root `backend`, `npm start`, health `/health`
- **DB:** Supabase — run migrations before go-live
- **Mobile:** `eas build --profile preview --platform android`

Full steps: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Environment variables

Backend: see `backend/.env.example`. Mobile: `EXPO_PUBLIC_API_URL`.

## Repository

- **This repo:** [github.com/willerbinance9-ui/mini](https://github.com/willerbinance9-ui/mini)
- Render setup: [docs/RENDER_SETUP.md](docs/RENDER_SETUP.md)
- Upstream: [github.com/willerdev/ema](https://github.com/willerdev/ema)
