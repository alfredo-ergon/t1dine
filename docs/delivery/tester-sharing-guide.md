# Sharing T1Dine with an external tester

The mobile app is Expo (SDK 54). This repo is already configured for EAS builds
([`apps/mobile/eas.json`](../../apps/mobile/eas.json), camera permission +
version in [`apps/mobile/app.json`](../../apps/mobile/app.json)).

**The two platforms differ a lot in how you share with an external tester:**

| | Android | iOS / Apple |
|---|---|---|
| How | Standalone `.apk` the tester installs from a link | **TestFlight** (Apple forbids sideloading) |
| Cost | Free | **Apple Developer Program — $99/year** |
| Review | None | Internal testers (≤100): none. External testers (≤10 000): one-time beta review per first build |
| Speed | Minutes | First TestFlight build takes longer (Apple credentials + processing) |

Do the **Android APK** first (quick, free), then set up **iOS/TestFlight** when you
have the Apple Developer Program.

## One-time setup (you, with a free Expo account)

```bash
npm i -g eas-cli          # or use: npx eas-cli@latest <cmd>
cd apps/mobile
eas login                 # free Expo account
eas init                  # creates the Expo project + writes its projectId into app.json
```

## Android — installable APK (free, minutes)

```bash
cd apps/mobile
eas build --platform android --profile preview
```

- The build runs on Expo's cloud. When it finishes, EAS prints a **build page URL**
  with a **QR code and a download link** for the `.apk`.
- Send that link/QR to your tester. On the S24 they tap it, download the APK, and
  install it (Android asks to allow "install unknown apps" the first time).
- To re-share after changes, run the same command again and send the new link.

## iOS — TestFlight (needs the Apple Developer Program, $99/year)

Apple does not allow sideloading for external testers, so iOS goes through
**TestFlight**. One-time: enrol in the **Apple Developer Program**
(developer.apple.com) and create the app record in **App Store Connect** (bundle
id `app.t1dine.mobile`, already set in `app.json`).

```bash
cd apps/mobile
eas build --platform ios --profile production      # EAS creates/manages the iOS credentials interactively
eas submit --platform ios --latest                 # uploads the build to App Store Connect / TestFlight
```

Then, in **App Store Connect → TestFlight**:
- **Internal testers** (up to 100, must be users on your App Store Connect team):
  they get the build immediately, no review — the fastest path for a trusted tester
  you can add as a team user.
- **External testers** (up to 10 000, invited by email/Apple ID, grouped): the
  first build you send to external testing needs a one-time **beta review** (usually
  a day); after that, invited testers install via the **TestFlight** app.

> Alternative without TestFlight: **ad-hoc** internal distribution
> (`eas build -p ios --profile preview` with `distribution: "internal"`) registers
> the tester's **device UDID** and produces an installable link — but it still needs
> the Apple Developer Program, and you must collect each device's UDID up front.
> TestFlight is simpler for anyone beyond one or two known devices.

## Keeping both in sync

Bump `version` (and, for the stores, the build number — `eas build` `autoIncrement`
in the production profile handles it) in `app.json`, rebuild each platform, and
re-share. Both platforms read the same JS bundle, so a feature you see on the web
preview is what the tester gets.

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
