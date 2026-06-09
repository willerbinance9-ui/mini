# PureHarvest (EMA Mobile)

React Native app built with Expo and EAS.

## Local development

```bash
cd ema-mobile
cp .env.example .env
npm install
npm start
```

Set `EXPO_PUBLIC_API_URL` in `.env` to your backend (emulator: `http://10.0.2.2:4000`, device: your LAN IP).

## Preview APK (internal)

The `preview` EAS profile builds an installable **Android APK** against production API:

```bash
npm run build:preview:apk
```

Or trigger from GitHub Actions: **Actions → EMA Mobile Preview APK → Run workflow**.

### GitHub + Expo setup (one time)

1. Create an access token at [expo.dev → Access tokens](https://expo.dev/accounts/willerbinance/settings/access-tokens).
2. Add it to the GitHub repo as secret `EXPO_TOKEN`:
   ```bash
   gh secret set EXPO_TOKEN -R willerbinance9-ui/mini
   ```
3. Push to `main` (or run the workflow manually). EAS builds the APK on Expo servers.

Download the APK from the [Expo builds page](https://expo.dev/accounts/willerbinance/projects/pureharvest/builds) when the build completes.
