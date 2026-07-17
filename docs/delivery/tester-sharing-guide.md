# Sharing T1Dine with an external tester

The mobile app is Expo (SDK 54). The simplest way to put it on an external
tester's phone — especially an **Android** device like the Galaxy S24 — is an
**EAS preview build**: a standalone `.apk` the tester installs directly (no dev
server, works offline). This repo is already configured for it
([`apps/mobile/eas.json`](../../apps/mobile/eas.json), camera permission +
version in [`apps/mobile/app.json`](../../apps/mobile/app.json)).

## One-time setup (you, with a free Expo account)

```bash
npm i -g eas-cli          # or use: npx eas-cli@latest <cmd>
cd apps/mobile
eas login                 # free Expo account
eas init                  # creates the Expo project + writes its projectId into app.json
```

## Build an installable APK and share it

```bash
cd apps/mobile
eas build --platform android --profile preview
```

- The build runs on Expo's cloud. When it finishes, EAS prints a **build page URL**
  with a **QR code and a download link** for the `.apk`.
- Send that link/QR to your tester. On the S24 they tap it, download the APK, and
  install it (Android asks to allow "install unknown apps" the first time).
- To re-share after changes, run the same command again and send the new link.

> **iOS tester?** iOS can't sideload a bare `.ipa` — it needs TestFlight, which
> requires a paid Apple Developer account. `eas build -p ios --profile preview`
> + `eas submit`/TestFlight is the path. Android APK is the quick win first.

## What the tester can do — offline vs online

The preview APK is **fully usable offline** (T1Dine is local-first):
search the bundled catalog, build meals, **Diário**, **Receitas**, **Perfis**,
favourites, custom foods, dose review — all work with no server.

The **online-only** features need the API to be reachable from the tester's
phone (a public URL, not your `localhost`):
- the full INSA catalogue (1 500+ foods) instead of the bundled subset,
- barcode lookup via **Open Food Facts**,
- **Nightscout** read-only glucose.

The app reads the API address from the build-time env var
`EXPO_PUBLIC_API_BASE_URL` (default `http://localhost:3001`, which a phone can't
reach). To enable the online features for the tester:

1. Deploy the API (`services/api`) to a public host (see the architecture docs —
   Azure Container Apps is the target; Railway/Render/Fly.io work for a quick
   test host). It has an in-memory fallback, so it runs with no database.
2. In `apps/mobile/eas.json`, set the preview profile's env to the deployed URL:
   ```json
   "preview": {
     "distribution": "internal",
     "android": { "buildType": "apk" },
     "env": { "EXPO_PUBLIC_API_BASE_URL": "https://your-deployed-api.example.com" }
   }
   ```
3. Rebuild (`eas build -p android --profile preview`) and re-share.

## Notes

- `preview` uses `distribution: "internal"` — no app-store review; anyone with the
  link can install. Fine for a trusted tester; don't post it publicly.
- Health data stays on the device (local-first); the Nightscout token is stored in
  the OS keystore and never leaves the device except on an explicit sync.
- For over-the-air updates without a rebuild, add EAS Update later
  (`eas update`), pinning a `runtimeVersion`.
