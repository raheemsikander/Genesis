# Adding a New Environment

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

`genesis-api-<env>`'s initial deploy will fail because secrets aren't set yet — this is expected. Don't wait for it (takes ~5 min); proceed to set secrets below. The worker might fail too if it's using env vars.

### Set secrets, run migrations, and redeploy

Two ways:

- **Option 1 — shortcut script:** from the repo root, run `pnpm provision:render-env <env-name>` (e.g. `preview`). The script prompts for your Render API key ([create one](https://dashboard.render.com/u/settings#api-keys) if you haven't). To skip the prompt on future runs, `export RENDER_API_KEY=rnd_...` in your shell. The script confirms the detected service names from `render.yaml`, prompts for each env-group secret (use test Clerk keys for non-prod), pushes them, fetches the Postgres External URL, runs migrations, and triggers redeploys. At the end it prints the `DATABASE_URL` + dashboard URLs for the API/worker deploy hooks — **save those**; you'll paste them when you run `pnpm provision:github-env <env-name>` in Step 5.

- **Option 2 — Render UI:** follow the sub-sections below.

#### Set secrets (UI)

Go to Render Dashboard → **Environment Groups** → `preview-secrets` (shared by the API and worker) and fill in the variables listed in [`ENV_VARS.md`](ENV_VARS.md) under **Render — Server Environment Group**. Use Clerk keys appropriate for this environment (typically test keys for non-production).

After setting the secrets, trigger a **manual redeploy** on the API (and on the worker, if it also failed): go to the service → **Manual Deploy** → **Deploy latest commit**.

#### Run database migrations (UI)

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

Set up the new Vercel environment — custom environment, env vars, protection toggle, domain, and deploy hook. Two ways:

- **Option 1 — shortcut script:** from the repo root:
  1. One-time: run `pnpm dlx vercel login` (browser OAuth).
  2. Run `pnpm provision:vercel-env <env-name> --project <slug> --branch <branch>`.

  The script creates the custom Vercel environment tracking the given branch, disables deployment protection, prompts you interactively for env-var values (auto-filling `NEXT_PUBLIC_NODE_ENV` and the Clerk sign-in/sign-up URLs), prompts for a domain (**required** for non-production envs — see below), and creates the deploy hook.

  When prompted for the domain, you can pick either:
  - A free `.vercel.app` subdomain — instant, works as a stable URL. You can swap in a custom domain later by following [`CUSTOM_DOMAIN.md`](integrations/CUSTOM_DOMAIN.md).
  - A custom domain — the script assigns it and prints the DNS records you need to add at your DNS provider. Follow [`CUSTOM_DOMAIN.md`](integrations/CUSTOM_DOMAIN.md) for the full walkthrough.

  The script also triggers the first deployment automatically (by hitting the deploy hook). The hook URL is printed at the end — **save it**; you'll paste it as `VERCEL_DEPLOY_HOOK` when you run `pnpm provision:github-env <env-name>` in Step 5.

- **Option 2 — Vercel UI:** follow the sub-sections below.

### Create the environment (UI)

Create a new pre-production environment in Vercel for the new branch:

1. Go to **Project → Settings → Environments**
2. Click **Create Environment** (pre-production)
3. Set **Environment Name** to match the branch (e.g. `preview`)
4. Enable **Branch Tracking** and set the branch to match (e.g. `preview`)
5. Click **Create Environment**

Then go to **Project → Settings → Environment Variables** and add the variables listed in [`ENV_VARS.md`](ENV_VARS.md) under **Vercel — Web Environment Variables**, scoped to the new environment. Set `NEXT_PUBLIC_SERVER_URL` to the new env's Render API URL and `NEXT_PUBLIC_NODE_ENV` to match the env name.

### Create a deploy hook (UI)

Vercel auto-deploy on git push is **disabled** via `apps/web/vercel.json`. Deploys are triggered exclusively by the GitHub Actions `deploy.yml` workflow via a deploy hook.

1. Go to **Project → Settings → Git → Deploy Hooks**
2. Create a hook named after the environment (e.g. `preview`) targeting the new branch
3. Copy the URL — you will add this as a GitHub secret in the next step

### Assign a custom domain (UI)

Vercel does not automatically assign a stable URL to pre-production environments. You must add a custom domain so the new branch has a permanent URL (used for `CORS_ORIGIN` on Render).

1. Go to **Project → Domains**
2. Add a new domain like `your-project-preview.vercel.app`
3. When prompted, assign it to the new environment (not Production)

If you want to use a custom domain instead, follow [`CUSTOM_DOMAIN.md`](integrations/CUSTOM_DOMAIN.md).

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

Set up the GitHub environment for your new branch (e.g. `preview`) and its secrets. Two ways:

- **Option 1 — shortcut script:** from the repo root:
  1. One-time: install `gh` (`brew install gh` on macOS, see [install guide](https://github.com/cli/cli#installation) for other platforms) and run `gh auth login` (browser OAuth).
  2. Run `pnpm provision:github-env <env-name>` (e.g. `preview`).

  The script creates the GitHub environment if missing and prompts you for each required secret, setting them via `gh secret set --env`.
- **Option 2 — GitHub UI:** go to GitHub repo → **Settings → Environments → New environment** → name it to match the branch (e.g. `preview`). Then add the secrets listed in [`ENV_VARS.md`](ENV_VARS.md) under **GitHub — Environment Secrets**, pointing at the new environment's Render services and the Vercel deploy hook created in Step 3.

---

## Step 6 — (Optional) Test the CI/CD flow

To confirm the full pipeline works end-to-end, open a small PR into the environment branch and merge it. Check that the `deploy.yml` run in GitHub Actions passes (migrations, Render deploy, Vercel deploy) and the site reflects the change.
