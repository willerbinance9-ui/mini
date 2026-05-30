# Render setup for mini-backend

**Prerequisite:** Push `main` to GitHub — see [GITHUB_PUSH.md](./GITHUB_PUSH.md) if `git push` fails with permission denied.

After the repo is on [willerbinance9-ui/mini](https://github.com/willerbinance9-ui/mini):

## 1. Create service

1. [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint**
2. Connect GitHub → select **willerbinance9-ui/mini**
3. Apply root [`render.yaml`](../render.yaml) (service `mini-backend`, root dir `backend`)

## 2. Required environment variables

**Quick path:** copy [`backend/render.env`](../backend/render.env) (local only, gitignored), fill blanks, then Render → **Environment** → **Add from .env**.

Or set manually (secrets marked sync: false in blueprint):

| Variable | Notes |
|----------|--------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server only) |
| `JWT_SECRET` | Random string |
| `APP_BASE_URL` | `https://<your-service>.onrender.com` after first deploy |
| `ADMIN_USERNAME` | Admin console login |
| `ADMIN_PASSWORD` | Strong password |
| `TOTP_ENCRYPTION_KEY` | `openssl rand -hex 32` |
| `INTERNAL_CRON_SECRET` | Cron auth header |

Optional: `NOWPAYMENTS_*`, `MT5_METAAPI_TOKEN`, `DEEPSEEK_API_KEY`, Tatum, Flutterwave.

## 3. Database

Before `/health/db` succeeds, run in Supabase SQL editor:

1. `backend/sql/schema.sql`
2. All files in `backend/sql/migrations/` (filename order)

## 4. Verify

```bash
curl https://<your-host>/health
curl https://<your-host>/health/db
```

Admin UI: `https://<your-host>/admin`

## 5. Mobile app

Set `EXPO_PUBLIC_API_URL=https://<your-host>` in `ema-mobile/.env` and rebuild or restart Expo.
