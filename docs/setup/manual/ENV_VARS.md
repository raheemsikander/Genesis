# Deployed Environment Variables

Env vars to set when provisioning a deployed environment on Render + Vercel + GitHub Actions. For local setup, see [`LOCAL_ENV.md`](LOCAL_ENV.md).

---

## Render — Server Environment Group

Set these on the env var group shared by the API and worker services (e.g. `staging-secrets`, `production-secrets`). Two ways to add them:

- **Option 1 — one at a time:** copy each variable below into the UI (Environment Groups → your group → **Add Environment Variable**).
- **Option 2 — bulk paste `.env` block:** fill in the values in the block below, then in Render: Environment Groups → your group → **Add from .env** → paste → Save.

  <details>
  <summary>Bulk paste the following block</summary>

  ```
  CORS_ORIGIN=
  CLERK_SECRET_KEY=
  CLERK_PUBLISHABLE_KEY=
  RESEND_API_KEY=
  RESEND_FROM_EMAIL=
  S3_ENDPOINT=
  S3_ACCESS_KEY_ID=
  S3_SECRET_ACCESS_KEY=
  S3_REGION=
  S3_BUCKET=
  ROLLBAR_SERVER_TOKEN=
  ```
  </details>

| Variable | Required | How to get it |
|---|---|---|
| `CORS_ORIGIN` | Yes | The full Vercel URL for this env (include `https://`, no trailing slash). Use `http://localhost:3001` as a placeholder until Vercel is set up. |
| `CLERK_SECRET_KEY` | Yes | Clerk Dashboard → API Keys. Use `sk_test_...` for non-production, `sk_live_...` for production. See [`CLERK.md`](integrations/CLERK.md) for per-env app setup. |
| `CLERK_PUBLISHABLE_KEY` | Yes | Clerk Dashboard → API Keys. Use `pk_test_...` for non-production, `pk_live_...` for production. See [`CLERK.md`](integrations/CLERK.md) for per-env app setup. |
| `RESEND_API_KEY` | Optional | Resend Dashboard → API Keys. Required if the app sends email. |
| `RESEND_FROM_EMAIL` | Optional | A sender address verified in Resend. |
| `S3_ENDPOINT` | Optional | S3-compatible storage endpoint. See [`R2_STORAGE.md`](integrations/R2_STORAGE.md). |
| `S3_ACCESS_KEY_ID` | Optional | S3 access key. |
| `S3_SECRET_ACCESS_KEY` | Optional | S3 secret key. |
| `S3_REGION` | Optional | Set to `auto` for Cloudflare R2. |
| `S3_BUCKET` | Optional | Defaults to `file-uploads`. |
| `ROLLBAR_SERVER_TOKEN` | Optional (recommended for production) | Rollbar `post_server_item` token. See [`ROLLBAR.md`](integrations/ROLLBAR.md). |

---

## Vercel — Web Environment Variables

Set these on each Vercel environment (Production, staging, etc.). Scope each variable to the matching environment. Two ways to add them:

- **Option 1 — one at a time:** copy each variable below into the UI (Project → Settings → Environment Variables → **Add New**), picking the target environment before saving.
- **Option 2 — bulk paste a `.env` block:** fill in the values in the block below, then in Vercel: Project → Settings → Environment Variables → paste into the key input → pick the target environment → Save.

  <details>
  <summary>Bulk paste the following block</summary>

  ```
  NEXT_PUBLIC_SERVER_URL=
  NEXT_PUBLIC_NODE_ENV=
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
  CLERK_SECRET_KEY=
  NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
  NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
  NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN=
  ROLLBAR_CLIENT_SOURCEMAP_TOKEN=
  DEPLOY_URL=
  NEXT_PUBLIC_MIXPANEL_TOKEN=
  ```
  </details>

| Variable | Required | How to get it |
|---|---|---|
| `NEXT_PUBLIC_SERVER_URL` | Yes | The Render API service URL for this env (e.g. `https://genesis-api-staging.onrender.com`). Get it from Render → open the API service (`genesis-api-staging` / `genesis-api-prod` or whatever you renamed it to) → the URL is displayed at the top of the service page, right under the service name. |
| `NEXT_PUBLIC_NODE_ENV` | Yes | `staging`, or `production` — matches the environment name. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Same Clerk publishable key as the server (`pk_test_...` or `pk_live_...`). |
| `CLERK_SECRET_KEY` | Yes | Same Clerk secret key as the server (`sk_test_...` or `sk_live_...`). |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Yes | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Yes | `/sign-up` |
| `NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN` | Optional (recommended for production) | Rollbar `post_client_item` token. See [`ROLLBAR.md`](integrations/ROLLBAR.md). |
| `ROLLBAR_CLIENT_SOURCEMAP_TOKEN` | Optional (only if Rollbar is enabled) | Rollbar `post_server_item` token from the client project — used at build time to upload source maps. |
| `DEPLOY_URL` | Optional (only if Rollbar is enabled) | The deployed site URL, no trailing slash. Used as the URL prefix for source map uploads. Set after the domain is assigned. |
| `NEXT_PUBLIC_MIXPANEL_TOKEN` | Optional | Mixpanel project token (one per environment). Leave unset to disable analytics and session replay. See [`MIXPANEL.md`](integrations/MIXPANEL.md). |

---

## GitHub — Environment Secrets

Set these under **GitHub repo → Settings → Environments → `<env-name>`** (one GitHub environment per deployed env).

| Secret | How to get it |
|---|---|
| `DATABASE_URL` | Render → the env's PostgreSQL service → Connections → **External Database URL**. Always append `?sslmode=require`. |
| `RENDER_API_KEY` | Render → search "API Keys" → **Create API Key**. Same value works for staging + production. |
| `RENDER_API_SERVICE_ID` | Render → the env's API web service → URL bar shows `srv-...`. Copy that. |
| `RENDER_WORKER_SERVICE_ID` | Render → the env's worker service → URL bar shows `srv-...`. Only if the worker is enabled. |
| `VERCEL_DEPLOY_HOOK` | Vercel → Project Settings → Git → Deploy Hooks → the hook you created for this env. |

**Why GitHub needs its own secrets:** `DATABASE_URL` is used by GitHub Actions to run migrations from outside Render. `deploy.yml` calls Render's REST API (`POST /v1/services/{id}/deploys` with `Authorization: Bearer $RENDER_API_KEY`) to trigger deploys — service IDs aren't secret (visible in the dashboard URL), but the API key is. Vercel still uses a webhook URL.
