# Push to GitHub (willerbinance9-ui/mini)

The project is committed locally on `main`. Push failed because Git is authenticated as **willerdev**, which does not have write access to **willerbinance9-ui/mini**.

## Option A — HTTPS with personal access token

1. Create a [GitHub PAT](https://github.com/settings/tokens) for account **willerbinance9-ui** with `repo` scope.
2. From the project root:

```bash
cd /Users/willer/Desktop/mini
git remote set-url origin https://github.com/willerbinance9-ui/mini.git
git push -u origin main
```

When prompted, use username `willerbinance9-ui` and the PAT as the password.

## Option B — SSH

1. Add an SSH key to the **willerbinance9-ui** GitHub account.
2. Run:

```bash
git remote set-url origin git@github.com:willerbinance9-ui/mini.git
git push -u origin main
```

## Verify

Open https://github.com/willerbinance9-ui/mini — the monorepo (`backend/`, `ema-mobile/`, `render.yaml`) should appear on `main`.

Then follow [RENDER_SETUP.md](./RENDER_SETUP.md) to deploy on Render.
