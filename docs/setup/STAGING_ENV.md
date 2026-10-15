# Setting Up the Staging Environment

This document covers how to set up the staging (QA/testing) environment from scratch. Read [`LOCAL_ENV.md`](LOCAL_ENV.md) first if you haven't set up local development yet.

---

## Step 1 — Render

Before you start: if you forked Genesis for a new product, rename `genesis` to your project name throughout `render.yaml` (the `projects.name` field and all `genesis-*` resource names), then commit and push to `develop` before proceeding. Otherwise your Render services will be named `genesis-*`.


1. Go to [render.com](https://render.com) and sign up with the **client's email** (not GitHub). Using the client's email ensures they own the account from day one — simplifies handoff later.
2. Add a payment method. Render requires a valid credit card on file **even for the free tier** before you can provision any services — you won't be charged on free plans, but the card is mandatory to unblock Blueprint creation. Add it via **Workspace Settings → Billing → Payment Methods**.
3. Upgrade your workspace to **Professional** ($19/user/mo) or higher. You can do this later — Render's free Postgres gives you ~44 days (30-day lifetime + 14-day grace) before the database is deleted, and free web services just sleep on inactivity (no data loss). Upgrade anytime before the 30-day mark to keep the database and stop services from sleeping.
4. The worker is commented out in `render.yaml` by default to avoid unnecessary build minutes and costs. If you need background/scheduled jobs, uncomment the worker block before syncing — follow the enable steps in the comment above it. This can also be done later when you actually need it.
5. In Render dashboard → **New** → **Blueprint** — Render will prompt you to connect GitHub. Install the Render GitHub App on your org and grant access to the repo.
6. On the repo-selection screen, if your repo isn't showing, click **Configure GitHub Account** on the right-hand side. This opens GitHub's app-installation page where you grant the Render GitHub App access to the correct org and repos (all repos, or just the ones you pick). Once you save there, you'll be returned to Render and the repo will appear in the list.
7. Select your repo and the branch where `render.yaml` lives — use `develop`
8. Name the Blueprint `<project>` — it manages all environments so name it generic
9. Confirm — Render reads `render.yaml` and creates the services

This creates:
- `staging-secrets` - Environment variable group
- `genesis-api-staging` — Express API (Docker)
- `genesis-worker-staging` — BullMQ worker (if enabled)
- `genesis-postgres-staging` — PostgreSQL database
- `genesis-redis-staging` — Redis cache

`genesis-api-staging`'s initial deploy will fail because secrets aren't set yet — this is expected. Don't wait for it (takes ~5 min); proceed to set secrets below.

### Set secrets, run migrations, and redeploy

Two ways:

- **Option 1 — shortcut script:** from the repo root:
  1. One-time: create a Render API key at [dashboard.render.com → Account → API Keys](https://dashboard.render.com/u/settings#api-keys). (Render CLI's `render login` writes an OAuth token that expires quickly and can't be used for scripted access — the dashboard API key is the supported path.)
  2. Run `pnpm provision:render-env staging`. The script prompts for the API key on first run — paste it in. To skip the prompt on future runs, `export RENDER_API_KEY=rnd_...` in your shell.

  The script confirms the detected service names from `render.yaml`, prompts you interactively for each env-group secret (auto-filling `S3_REGION=auto`, `S3_BUCKET=file-uploads`), pushes them via `PUT /v1/env-groups/{id}/env-vars`, fetches the Postgres External URL, runs migrations (`pnpm --filter server db:migrate` with the fetched `DATABASE_URL`), and triggers redeploys on the API (and worker if present). At the end it prints the `DATABASE_URL` + dashboard URLs for the API/worker deploy hooks — **save those**; you'll paste them as `DATABASE_URL`, `RENDER_API_DEPLOY_HOOK`, and `RENDER_WORKER_DEPLOY_HOOK` when you run `pnpm provision:github-env staging` in Step 4.

- **Option 2 — Render UI:** follow the sub-sections below.

#### Set secrets (UI)

Go to Render Dashboard → **Environment Groups** → `staging-secrets` (shared by the API and worker) and fill in the variables listed in [`ENV_VARS.md`](ENV_VARS.md) under **Render — Server Environment Group**.

After setting the secrets, trigger a **manual redeploy** on the API (and on the worker, if it also failed): go to the service → **Manual Deploy** → **Deploy latest commit**.

#### Run database migrations (UI)

Migrations do **not** run during the Render deploy — they run via GitHub Actions on merges to `develop`. Since this is a fresh setup with no schema yet, run them manually once:

Get the **External Database URL** from Render → `genesis-postgres-staging` → **Connections** → **External Database URL**. Always append `?sslmode=require`.

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
curl https://genesis-api-staging.onrender.com/health
```

It should return a health check response. Free-tier cold starts may take ~30 seconds.

---

## Step 2 — Vercel

**Account prerequisites** (one-time, manual — cannot be automated):
1. Sign up at [vercel.com](https://vercel.com) with the **client's email** (not GitHub) — client owns the account from day one.
2. Upgrade to a Pro account.
3. Install the Vercel GitHub App on your GitHub org (Vercel prompts for this the first time you try to import a repo).

Then set up the `staging` Vercel environment — project, env vars, custom environment, protection toggle, domain, and deploy hook. Two ways:

- **Option 1 — shortcut script:** from the repo root:
  1. One-time: run `pnpm dlx vercel login` (browser OAuth).
  2. Run `pnpm provision:vercel-env staging --project <slug>`.

  The script creates the Vercel project if missing (linked to this repo, framework `nextjs`, root `apps/web`), creates the `staging` custom environment tracking `develop`, disables deployment protection, prompts you interactively for env-var values (auto-filling `NEXT_PUBLIC_NODE_ENV` and the Clerk sign-in/sign-up URLs), prompts for a domain (**required** for staging — see below), and creates the deploy hook.

  When prompted for the domain, you can pick either:
  - A free `.vercel.app` subdomain (e.g. `your-project-staging.vercel.app`) — instant, works as a stable URL. You can swap in a custom domain later by following [`CUSTOM_DOMAIN.md`](integrations/CUSTOM_DOMAIN.md).
  - A custom domain (e.g. `staging.example.com`) — the script assigns it and prints the DNS records you need to add at your DNS provider. Follow [`CUSTOM_DOMAIN.md`](integrations/CUSTOM_DOMAIN.md) for the full walkthrough.

  The script also triggers the first deployment automatically (by hitting the deploy hook). The hook URL is printed at the end — **save it**; you'll paste it as `VERCEL_DEPLOY_HOOK` when you run `pnpm provision:github-env staging` in Step 4.

- **Option 2 — Vercel UI:** follow the sub-sections below in order.

### First-time setup (UI)

1. **New Project** → import your repo (Vercel will prompt you to install the Vercel GitHub App if not already connected)
2. Set **Root Directory** to `apps/web`
3. Framework preset: **Next.js** (usually auto-detected — set it manually if Vercel picks something else)
4. Build command (toggle and edit): `pnpm build`
5. Install command (toggle and edit): `pnpm install --frozen-lockfile`
6. Add environment variables — use the **staging** values from [`ENV_VARS.md`](ENV_VARS.md) (Vercel — Web Environment Variables). These land in the Production scope by default because the `staging` env doesn't exist yet; we'll re-use them when we create the staging env in the next step, and overwrite them with real prod values later when following [`PROD_ENV.md`](PROD_ENV.md).

### Create the staging environment (UI)

Vercel creates a **Production** environment by default (tied to `main`). You need to create a separate environment for `staging`:

1. Go to **Project → Settings → Environments**
2. Click **Create Environment** (pre-production)
3. Set **Environment Name** to `staging`
4. Enable **Branch Tracking** and set the branch to `develop`
5. Toggle import variables from another environment and select Production (we just set those above)
6. Click **Create Environment**

### Disable Deployment Protection (UI)
Vercel Pro enables Deployment Protection by default on non-production environments, which requires a Vercel login to view the site. To make the staging environment publicly accessible:

1. Go to **Project → Settings → Deployment Protection**
2. Disable protection under Vercel Authentication

### Create a deploy hook (UI)

Vercel auto-deploy on git push is **disabled** via `apps/web/vercel.json`. Deploys are triggered exclusively by the GitHub Actions `deploy.yml` workflow via a deploy hook.

1. Go to **Project → Settings → Git → Deploy Hooks**
2. Create a hook named `staging` targeting the `develop` branch
3. Copy the URL — you will add this as a GitHub secret in the next step

### Assign a custom domain (UI)

Vercel does not automatically assign a stable URL to pre-production environments. You must add a custom domain so the staging environment has a permanent URL (used for `CORS_ORIGIN` on Render).

1. Go to **Project → Domains**
2. Add a new domain like `your-project-staging.vercel.app`
3. When prompted, assign it to the **staging** environment

If you want to use a custom domain instead, follow [`CUSTOM_DOMAIN.md`](integrations/CUSTOM_DOMAIN.md).

### Verify the frontend is live

Open the Vercel staging URL in a browser — you should see the landing page or sign-in page. Sign-in won't work yet because `CORS_ORIGIN` on Render still points at the placeholder; we fix that next.

---

## Step 3 — Update CORS_ORIGIN

Once the Vercel domain is assigned, update `CORS_ORIGIN` on the Render env var group:
- Render Dashboard → **Environment Groups** → `staging-secrets` → set `CORS_ORIGIN` to the Vercel staging domain (must include `https://` and no trailing slash)

Then trigger a **manual redeploy** on the Render API so it picks up the new value: Render → `genesis-api-staging` → **Manual Deploy** → **Deploy latest commit**.

### Verify end-to-end

Once the redeploy shows **Live**, sign in on the Vercel staging URL via Clerk and navigate to the portal. Check the Render API logs to confirm the user sync happened. If the frontend shows CORS errors, double-check that `CORS_ORIGIN` on Render matches the Vercel URL exactly (including `https://`, no trailing slash).

---

## Step 4 — GitHub Environment

Set up the `staging` GitHub environment and its secrets. Two ways:

- **Option 1 — shortcut script:** from the repo root:
  1. One-time: install `gh` (`brew install gh` on macOS, see [install guide](https://github.com/cli/cli#installation) for other platforms) and run `gh auth login` (browser OAuth).
  2. Run `pnpm provision:github-env staging`.

  The script creates the GitHub environment if missing and prompts you for each required secret, setting them via `gh secret set --env`.
- **Option 2 — GitHub UI:** go to GitHub repo → **Settings → Environments → New environment** → name it `staging`. Then add the secrets listed in [`ENV_VARS.md`](ENV_VARS.md) under **GitHub — Environment Secrets**, using the `genesis-*-staging` Render services and the Vercel staging deploy hook created in Step 2.

---

## Step 5 — (Optional) Test the CI/CD flow

To confirm the full pipeline works end-to-end, open a small PR into `develop` and merge it. Check that the `deploy.yml` run in GitHub Actions passes (migrations, Render deploy, Vercel deploy) and the site reflects the change.

