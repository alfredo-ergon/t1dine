# Deploying the T1Dine API to Azure Container Apps

Deploys `services/api` as a public **HTTPS** endpoint (Container Apps gives you TLS
+ a public FQDN automatically), hardened per
[`docs/security/api-deployment-hardening.md`](../security/api-deployment-hardening.md).
The app runs from the repo-root [`Dockerfile`](../../Dockerfile) (tsx runtime, no
build step) and needs no database (in-memory store; catalogue reseeds on start).

> **Target subscription:** `771b752a-6149-480f-93a1-e6f7114328ad`
> (tenant `27a0c450-8dc5-42f2-a0fa-2ebbd3036d7e`,
> `cassisalfredogmail.onmicrosoft.com`). The `az` CLI on this machine is currently
> logged into a **different** account (`firstcentralsg.com`), so **you must log in
> to the target tenant first** — that step is interactive (browser/device code)
> and can't be automated.

## 1. Log in to the correct tenant/subscription

```bash
az login --tenant 27a0c450-8dc5-42f2-a0fa-2ebbd3036d7e
az account set --subscription 771b752a-6149-480f-93a1-e6f7114328ad
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
```

## 2. Generate strong production secrets (do NOT commit these)

The hardened API **refuses to boot** in production with default/missing secrets.
Generate fresh ones and keep them somewhere safe (a password manager):

```bash
# bash / git-bash
AUTH_SECRET=$(openssl rand -hex 32)
SETTINGS_SECRET=$(openssl rand -hex 32)
ADMIN_PASSWORD=$(openssl rand -base64 24)
ADMIN_EMAIL="you@example.com"     # your curator login email
```
```powershell
# PowerShell equivalent
$AUTH_SECRET     = -join ((1..64) | % { '{0:x}' -f (Get-Random -Max 16) })
$SETTINGS_SECRET = -join ((1..64) | % { '{0:x}' -f (Get-Random -Max 16) })
$ADMIN_PASSWORD  = [Convert]::ToBase64String((1..24 | % { Get-Random -Max 256 }))
```

## 3. Build + deploy (one command, builds the Dockerfile in the cloud)

Run from the **repo root** (so the Docker build context is the whole monorepo):

```bash
az containerapp up \
  --name t1dine-api \
  --resource-group t1dine-rg \
  --location westeurope \
  --ingress external --target-port 3001 \
  --source . \
  --env-vars \
      NODE_ENV=production \
      PORT=3001 \
      AUTH_SECRET="$AUTH_SECRET" \
      SETTINGS_SECRET="$SETTINGS_SECRET" \
      ADMIN_PASSWORD="$ADMIN_PASSWORD" \
      ADMIN_EMAILS="$ADMIN_EMAIL"
```

`az containerapp up` creates the resource group, a Container Apps environment, an
ACR, builds the image, and deploys it. When it finishes it prints the public
**FQDN** (e.g. `https://t1dine-api.<hash>.westeurope.azurecontainerapps.io`).

> **CORS:** the mobile app sends no `Origin`, so it works without `CORS_ORIGINS`.
> Only set `CORS_ORIGINS=https://your-admin-web-origin` if you also deploy the
> admin web app and it must call this API from a browser.

## 4. Harden the secrets (recommended)

`--env-vars` stores values in plaintext in the app config. Move them to Container
Apps **secrets** so they're not shown in the portal:

```bash
az containerapp secret set -n t1dine-api -g t1dine-rg --secrets \
  auth-secret="$AUTH_SECRET" settings-secret="$SETTINGS_SECRET" admin-password="$ADMIN_PASSWORD"
az containerapp update -n t1dine-api -g t1dine-rg --set-env-vars \
  AUTH_SECRET=secretref:auth-secret SETTINGS_SECRET=secretref:settings-secret ADMIN_PASSWORD=secretref:admin-password
```

## 5. Point the app at the deployed API and rebuild for the tester

In [`apps/mobile/eas.json`](../../apps/mobile/eas.json), set the preview profile's
env to the FQDN from step 3:

```json
"preview": {
  "distribution": "internal",
  "android": { "buildType": "apk" },
  "ios": { "simulator": false },
  "env": { "EXPO_PUBLIC_API_BASE_URL": "https://t1dine-api.<hash>.westeurope.azurecontainerapps.io" }
}
```

Then rebuild and re-share (see [`tester-sharing-guide.md`](tester-sharing-guide.md)):
`cd apps/mobile && eas build -p android --profile preview`. The tester now gets the
full online catalogue, Open Food Facts barcode lookup, and Nightscout.

## Notes

- **No database** in this setup — submissions, the admin AI config, and any
  approvals live in memory and reset on restart/scale-to-zero. Fine for a tester;
  add PostgreSQL (`DATABASE_URL`) before real users. In production the API
  **fails closed** if `DATABASE_URL` is set but unreachable (won't silently drop
  data).
- **Cost:** Container Apps scales to zero when idle; a single test API costs
  cents. Delete with `az group delete -n t1dine-rg` when done.
- **Health data:** the API stores no user health data server-side in this
  configuration (meals/Diário/glucose stay on the device); the Nightscout token
  is per-request only and never persisted.
