# Adding a New Environment (manual / legacy)

> **The canonical "add a new env" flow is now [`../ADD_NEW_ENV.md`](../ADD_NEW_ENV.md).** This file describes the manual click-through-the-dashboards flow that the Terraform setup replaces. Kept as a backup.

This document is a checklist for adding a new deployed environment (e.g. preview). It references [`STAGING_ENV.md`](STAGING_ENV.md) — read that first if you haven't already.

The example below uses `preview`. The same steps apply for any non-production environment. For production setup, see [`PROD_ENV.md`](PROD_ENV.md) instead.

---

## Step 1 — Create the environment branch

New environment branches are created from `main` so they mirror stable production code:

```bash
git checkout main
git checkout -b preview
git push -u origin preview
```

### Branch protection rules

Apply branch protection rules to the new branch following the same setup described in the CLAUDE.md Git Workflow section. Modify the rules based on the requirements of the new environment.

### Update deploy.yml

In `.github/workflows/deploy.yml`, add the new branch to the `branches` list and update the `environment` expression to handle it:

```yaml
on:
  push:
    branches: [main, develop, preview]  # add your new branch

jobs:
  deploy:
    environment: ${{ github.ref_name == 'main' && 'production' || github.ref_name == 'preview' && 'preview' || 'staging' }}
```

---

## Step 2 — Render

In `render.yaml`, duplicate an existing environment block (e.g. `staging`) and update it for the new environment:

1. Change the environment `name` (e.g. `preview`)
2. Rename services, databases, and Redis with the new suffix (e.g. `genesis-api-preview`, `genesis-worker-preview`)
3. If you need background/scheduled jobs, include the worker block and rename it too
4. Update the `branch` to match your environment branch
5. Update `envVarGroups` name (e.g. `preview-secrets`)
6. Commit and push, then go to the Render dashboard → **Blueprints** → your Blueprint → **Sync**

### Set secrets

`genesis-api-preview`'s initial deploy will fail because secrets aren't set yet — this is expected. Don't wait for it (takes ~5 min); proceed to set secrets below. The worker might fail too if it's using env vars.

Go to Render Dashboard → **Environment Groups** → `preview-secrets` (shared by the API and worker) and fill in the variables listed in [`ENV_VARS.md`](ENV_VARS.md) under **Render — Server Environment Group**. Use Clerk keys appropriate for this environment (typically test keys for non-production).

After setting the secrets, trigger a **manual redeploy** on the API (and on the worker, if it also failed): go to the service → **Manual Deploy** → **Deploy latest commit**.

### Run database migrations

Migrations do **not** run during the Render deploy — they run via GitHub Actions on merges to the environment branch. Since this is a fresh setup with no schema yet, run them manually once:

Get the **External Database URL** from Render → `genesis-postgres-<env>` → **Connections** → **External Database URL**. Always append `?sslmode=require`.

```bash
cd apps/server && DATABASE_URL="<render-external-db-url>?sslmode=require" pnpm db:migrate
```

Verify the tables were created:

```bash
psql "<render-external-db-url>?sslmode=require" -c "\dt"
```

After this initial run, subsequent deploys via PR merges will run migrations automatically through GitHub Actions.

### Verify the backend is live

Wait until all Render services (API, worker, Postgres, Redis) show **Live** in the dashboard — first deploys can take 5–10 minutes. Then hit the health endpoint:

```bash
curl https://<new-env-api>.onrender.com/health
```

It should return a health check response. Free-tier cold starts may take ~30 seconds.

---

## Step 3 — Vercel

Create a new pre-production environment in Vercel for the new branch:

1. Go to **Project → Settings → Environments**
2. Click **Create Environment** (pre-production)
3. Set **Environment Name** to match the branch (e.g. `preview`)
4. Enable **Branch Tracking** and set the branch to match (e.g. `preview`)
5. Click **Create Environment**

Then go to **Project → Settings → Environment Variables** and add the variables listed in [`ENV_VARS.md`](ENV_VARS.md) under **Vercel — Web Environment Variables**, scoped to the new environment. Set `NEXT_PUBLIC_SERVER_URL` to the new env's Render API URL and `NEXT_PUBLIC_NODE_ENV` to match the env name.

### Create a deploy hook

Vercel auto-deploy on git push is **disabled** via `apps/web/vercel.json`. Deploys are triggered exclusively by the GitHub Actions `deploy.yml` workflow via a deploy hook.

1. Go to **Project → Settings → Git → Deploy Hooks**
2. Create a hook named after the environment (e.g. `preview`) targeting the new branch
3. Copy the URL — you will add this as a GitHub secret in the next step

### Assign a custom domain

Vercel does not automatically assign a stable URL to pre-production environments. You must add a custom domain so the new branch has a permanent URL (used for `CORS_ORIGIN` on Render).

1. Go to **Project → Domains**
2. Add a new domain like `your-project-preview.vercel.app`
3. When prompted, assign it to the new environment (not Production)

If you want to use a custom domain instead, follow [`CUSTOM_DOMAIN.md`](CUSTOM_DOMAIN.md).

### Verify the frontend is live

Open the Vercel environment URL in a browser — you should see the landing page or sign-in page. Sign-in won't work yet because `CORS_ORIGIN` on Render still points at the placeholder; we fix that next.

---

## Step 4 — Update CORS_ORIGIN

Once the Vercel domain is assigned, update `CORS_ORIGIN` on the Render env var group:
- Render Dashboard → **Environment Groups** → `preview-secrets` → set `CORS_ORIGIN` to the Vercel preview domain (must include `https://` and no trailing slash)

Then trigger a **manual redeploy** on the Render API so it picks up the new value: Render → the new env's API service → **Manual Deploy** → **Deploy latest commit**.

### Verify end-to-end

Once the redeploy shows **Live**, sign in on the Vercel environment URL via Clerk and navigate to the portal. Check the Render API logs to confirm the user sync happened. If the frontend shows CORS errors, double-check that `CORS_ORIGIN` on Render matches the Vercel URL exactly (including `https://`, no trailing slash).

---

## Step 5 — GitHub Environment

Go to GitHub repo → **Settings → Environments → New environment** → name it to match the branch (e.g. `preview`). Add the secrets listed in [`ENV_VARS.md`](ENV_VARS.md) under **GitHub — Environment Secrets**, pointing at the new environment's Render services and the Vercel deploy hook created in Step 3.

---

## Step 6 — (Optional) Test the CI/CD flow

To confirm the full pipeline works end-to-end, open a small PR into the environment branch and merge it. Check that the `deploy.yml` run in GitHub Actions passes (migrations, Render deploy, Vercel deploy) and the site reflects the change.
