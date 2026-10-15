# Setting Up the Production Environment (manual / legacy)

> **The canonical production setup is now [`../PRODUCTION.md`](../PRODUCTION.md).** This file describes the manual flow that the Terraform setup replaces. Kept as a backup.

This document is a checklist for adding the production environment. It assumes you already have the `staging` environment fully working (Render, Vercel, GitHub Actions). Read [`STAGING_ENV.md`](STAGING_ENV.md) first if you haven't.

Production differs from other environments — Vercel's Production environment is pre-configured, and Render's production block just needs to be uncommented.

Upgrade to a paid plan: Render's free tier only allows one instance of each resource type (database, Redis), so you can't run staging + prod side by side on free — you'll need to be on **Professional** ($19/user/mo) or higher before provisioning prod. Free Postgres also expires after 30 days (with a 14-day grace before deletion), and free web services sleep on inactivity.

---

## Prerequisite — `main` branch

The production deploy pipeline (`deploy.yml`, Vercel Production, Render production block) targets `main`. There are two cases to handle, depending on how the repo was created from the Genesis 2 template.

### Case A — `main` doesn't exist in your repo

If the template was used without **Include all branches**, `main` won't exist. Create it from `develop`:

```bash
git checkout develop
git pull
git checkout -b main
git push -u origin main
```

`main` and `develop` now share history, and the standard `develop → main` release flow works without any flags.

### Case B — `main` exists but its history is unrelated to `develop`

If the template was used with **Include all branches**, both `main` and `develop` are inherited from the template — but with **unrelated histories** (no common ancestor). The first attempt to merge `develop` into `main` for a release fails with:

```
fatal: refusing to merge unrelated histories
```

Run a one-time merge with `--allow-unrelated-histories` on a clean tree to give the two branches a common ancestor. Do this once, immediately after creating the repo from the template — well before your first production release:

```bash
git fetch origin main develop
git checkout -B main origin/main
git merge develop --allow-unrelated-histories
# resolve any trivial conflicts on shared files (README, configs)
git push origin main
```

After this, `main` and `develop` share history and the standard `develop → main` release flow works without any flags. This step does not apply if your project will only ever release from `main` directly.

### Confirm branch protection

In GitHub → **Settings → Branches**, confirm branch protection is configured for `main` (if you ran the **Configure Repository** workflow during local setup, it already is).

---

## Step 1 — Render

The production block is already defined in `render.yaml` but commented out. Uncomment the `production` environment section — this includes:
- `production-secrets` - Environment variable group
- `genesis-api-prod` — Express API (Docker)
- `genesis-worker-prod` — BullMQ worker (uncomment only if you need scheduled and background tasks)
- `genesis-redis-prod` — Redis cache
- `genesis-postgres-prod` — PostgreSQL database

After uncommenting, commit and push to `develop`, then go to Render dashboard → **Blueprints** → your Blueprint → **Sync**.

`genesis-api-prod`'s initial deploy will fail because secrets aren't set yet — this is expected. Don't wait for it (takes ~5 min); proceed to set secrets below. The worker might fail too if it's using env vars.

### Set secrets

Go to Render Dashboard → **Environment Groups** → `production-secrets` (shared by the API and worker) and fill in the variables listed in [`ENV_VARS.md`](ENV_VARS.md) under **Render — Server Environment Group**.

After setting the secrets, trigger a **manual redeploy** on the API (and on the worker, if it also failed): go to the service → **Manual Deploy** → **Deploy latest commit**.

### Run database migrations

Migrations do **not** run during the Render deploy — they run via GitHub Actions on merges to `main`. Since this is a fresh production database with no schema yet, run them manually once:

Get the **External Database URL** from Render → `genesis-postgres-prod` → **Connections** → **External Database URL**. Always append `?sslmode=require`.

```bash
cd apps/server && DATABASE_URL="<render-external-db-url>?sslmode=require" pnpm db:migrate
```

Verify the tables were created:

```bash
psql "<render-external-db-url>?sslmode=require" -c "\dt"
```

After this initial run, subsequent deploys via PR merges will run migrations automatically through GitHub Actions.

### Verify the backend is live

Wait until all Render services (API, worker, Postgres, Redis) show **Live** in the dashboard — first deploys can take 5–10 minutes. Then hit the health endpoint.

Get your API URL from Render → `genesis-api-prod` (or whatever you renamed it to) → it's displayed at the top of the service page, right under the service name. Append `/health` to that URL and use it in place of the example below if yours differs.

```bash
curl https://genesis-api-prod.onrender.com/health
```

It should return a health check response.

---

## Step 2 — Vercel

Vercel creates a **Production** environment by default, tied to `main`. No new environment needs to be created. Auto-deploy on git push is **disabled** via `apps/web/vercel.json`. Deploys are triggered exclusively by the GitHub Actions `deploy.yml` workflow via a deploy hook.

### Create a deploy hook

1. Go to **Project → Settings → Git → Deploy Hooks**
2. Create a hook named `production` targeting the `main` branch
3. Copy the URL — you will add this as a GitHub secret in the next step

### Environment variables

Go to **Project → Settings → Environment Variables** and add the variables listed in [`ENV_VARS.md`](ENV_VARS.md) under **Vercel — Web Environment Variables**, scoped to the **Production** environment.

Production might be associated with existing env variables. If that's the case, remove the production environment from them first, then add the new ones.

For production:

- `NEXT_PUBLIC_SERVER_URL` = `https://genesis-api-prod.onrender.com` (get your actual URL from Render → `genesis-api-prod` → displayed at the top of the service page, right under the service name)
- `NEXT_PUBLIC_NODE_ENV` = `production`
- `DEPLOY_URL` can be added after Step 4 (domain assignment).

### Trigger a redeploy

Env vars only apply on the next deploy. Trigger one using one of the following methods:

- `curl -X POST "<production-deploy-hook-url>"`
- Vercel dashboard → **Deployments** → ⋯ on the latest `main` deployment → **Redeploy**

### Verify the frontend is live

Open the Vercel production URL in a browser — you should see the landing page or sign-in page. Sign-in won't work yet because `CORS_ORIGIN` on Render still points at the placeholder; we fix that next.

---

## Step 3 — Update CORS_ORIGIN

The Production environment already has a domain assigned automatically (e.g. `your-project.vercel.app`). If you want to use a custom domain instead, follow [`CUSTOM_DOMAIN.md`](CUSTOM_DOMAIN.md).

Once the Vercel domain is confirmed, update `CORS_ORIGIN` on the Render env var group:
- Render Dashboard → **Environment Groups** → `production-secrets` → set `CORS_ORIGIN` to the Vercel production domain (must include `https://` and no trailing slash)

Then trigger a **manual redeploy** on the Render API so it picks up the new value: Render → `genesis-api-prod` → **Manual Deploy** → **Deploy latest commit**.

### Verify end-to-end

Once the redeploy shows **Live**, sign in on the Vercel production URL via Clerk and navigate to the portal. Check the Render API logs to confirm the user sync happened. If the frontend shows CORS errors, double-check that `CORS_ORIGIN` on Render matches the Vercel URL exactly (including `https://`, no trailing slash).

---

## Step 4 — GitHub Environment

Go to GitHub repo → **Settings → Environments → New environment** → name it `production`. Add the secrets listed in [`ENV_VARS.md`](ENV_VARS.md) under **GitHub — Environment Secrets**, using the `genesis-*-prod` Render services and the Vercel production deploy hook created in Step 2.

The `deploy.yml` workflow already handles `main` — no changes needed.

---

## Step 5 — (Optional) Test the CI/CD flow

To confirm the full pipeline works end-to-end, open a small PR from `develop` into `main` and merge it. Check that the `deploy.yml` run in GitHub Actions passes (migrations, Render deploy, Vercel deploy) and the site reflects the change.
