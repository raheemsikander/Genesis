# Phase 4: Deployment

**Goal:** App deployed via Terraform to Render (backend + Postgres + Redis) and Vercel (frontend), with automated deploys via GitHub Actions on every merge to `develop`/`main`.

**Docs (canonical, Terraform-driven):**
- `docs/setup/STAGING.md` — staging environment, 11 steps
- `docs/setup/PRODUCTION.md` — production environment (assumes staging is already up)

**Docs (fallback, legacy manual flow):**
- `docs/setup/manual/STAGING_ENV.md` / `manual/PROD_ENV.md` — click-through-the-dashboards setup, kept for forks that opt out of Terraform. Requires restoring `render.yaml` to the repo root (see the prereq at the top of that doc).

Follow the canonical docs unless the engineer explicitly asks for the manual flow. This reference adds state checks, verification, and troubleshooting on top of those docs — it does not duplicate them.

---

## State Check

Ask the engineer:
- **Which environment?** Staging or production. Production requires staging to be applied first — the `<project>-shared` TFC workspace and `shared/.envrc` it produces are reused.
- **Which flow?** Default to Terraform (canonical). Switch to manual only if they have a concrete reason (e.g., a fork that doesn't want IaC).
- **What's already in place?** Terraform installed? Render / Vercel / TFC accounts created? `shared/.envrc` populated? `<project>-shared` workspace applied?

Quick local checks:

```bash
terraform version                                     # 1.7+ required
ls infra/terraform/envs/shared/.envrc    2>/dev/null  # shared .envrc populated?
ls infra/terraform/envs/staging/.envrc   2>/dev/null  # staging .envrc populated?
```

---

## Context

Two distinct flows the engineer needs to keep straight — explain both before starting:

**Provisioning (one-time per environment, from the engineer's laptop):**

```
shared/.envrc + staging/.envrc
        │
        ▼
terraform apply (envs/shared)    ← creates Vercel + Render parent projects
        │
        ▼
terraform apply (envs/staging)   ← creates Postgres, Redis, web service,
                                   R2 bucket (if enabled), Vercel project +
                                   deploy hook, GitHub Environment +
                                   Actions secrets, runs initial
                                   pnpm db:migrate, triggers first deploys
```

**Ongoing deploys (every merge to `develop`/`main`, from GitHub Actions):**

```
PR merged → deploy.yml
        ├── pnpm db:migrate          (DATABASE_URL from Environment secret)
        ├── POST Render API deploy   (RENDER_API_KEY + RENDER_API_SERVICE_ID)
        └── POST Vercel deploy hook  (VERCEL_DEPLOY_HOOK)
```

Auto-deploy is disabled on both Render and Vercel — every deploy goes through `deploy.yml` so migrations always run first. Terraform writes the Actions secrets that the workflow reads; the engineer never sets them by hand.

---

## Verification & Troubleshooting

### Before STAGING.md Step 1 (dev identity)

Confirm the engineer has a **client-owned dev email** ready (e.g., `dev@<client-domain>.com`). They will sign up for every third-party service with this email — Render, Vercel, TFC, Cloudflare, Clerk, Resend, Rollbar — so the stack survives engineer rotation. If they're about to use their personal email, stop and explain why.

### Before STAGING.md Step 1 — `main` branch prerequisite (production only)

Before walking through production setup, confirm the `main` branch exists **and** shares history with `develop`. Repos created from the Genesis template via "Use this template" with **Include all branches** inherit both branches with **unrelated histories** — the first `git merge develop` into `main` fails with `fatal: refusing to merge unrelated histories`.

```bash
git fetch origin main develop
git merge-base origin/main origin/develop
```

A commit SHA means histories are linked — proceed. Empty output means the engineer needs the one-time `git merge develop --allow-unrelated-histories` step. This only matters for projects releasing `develop → main` (the standard flow).

### After STAGING.md Step 2 (Terraform installed)

```bash
terraform version
```

Must report **1.7 or later**. On macOS the easy path is `brew install hashicorp/tap/terraform tflint`.

### After STAGING.md Step 3 (.envrc files)

Both `shared/.envrc` and `staging/.envrc` should exist and be gitignored — `git status` must not list them. If they show up, the `infra/terraform/**/.envrc` ignore pattern is missing.

The engineer fills `shared/.envrc` incrementally as they generate each token in Steps 4–6. Don't run `terraform apply` until every required value is filled — `apply` aborts loudly on missing provider auth, but produces a half-finished state silently when app-tier vars (Clerk keys, frontend domain) are blank.

### After STAGING.md Step 4 (Render API key + Owner ID)

Sanity-check the API key works before continuing:

```bash
curl -s -H "Authorization: Bearer $RENDER_API_KEY" https://api.render.com/v1/owners | head -c 200
```

A 401 means the key is wrong. The response array contains the `id` to paste as `RENDER_OWNER_ID` — `tea-...` for a team, `usr-...` for a personal account; either works.

Also confirm the **Render GitHub App** is installed on the org that owns the repo (`https://github.com/apps/render`) with access to the fork. Terraform expects it to be there; without it, the auto-deploy wiring fails after apply.

### After STAGING.md Step 5 (Vercel API token + team ID)

Personal Vercel accounts: leave `TF_VAR_vercel_team_id` **unset** (don't paste `""` — leave the line blank or commented).

Also confirm the **Vercel GitHub App** is installed on the org (`https://github.com/apps/vercel`) with access to the fork.

### After STAGING.md Step 6 (GitHub PAT)

PAT must be generated while signed in as the **dev identity from Step 1**, not the engineer's personal account — that's the whole point of the shared identity. PATs are user-scoped and die with the user.

Required scope: **`repo`** only. Anything broader is unnecessary; anything narrower fails when Terraform tries to create the GitHub Environment.

### After STAGING.md Step 7 (TFC org + workspaces)

The TFC org slug must match `project_name` (set by `pnpm rename`). If the engineer named the TFC org differently, edit `infra/terraform/envs/{shared,staging}/backend.tf` and update the `organization` field — or they'll get `workspace not found` on `terraform init`.

**Execution Mode must be `Local`** for both workspaces (Settings → General). Terraform shells out to `pnpm db:migrate` during apply, which TFC's remote runners can't do.

Workspace names must match `backend.tf` exactly:
- `<project>-shared` ↔ `infra/terraform/envs/shared/backend.tf`
- `<project>-staging` ↔ `infra/terraform/envs/staging/backend.tf`

### After STAGING.md Step 8 (config check)

Quick verification — `project_name` should agree across the three relevant files:

```bash
grep -hE 'project_name|organization|name = "' \
  infra/terraform/envs/shared/backend.tf \
  infra/terraform/envs/shared/terraform.tfvars \
  infra/terraform/envs/staging/backend.tf
```

All instances of the project name (and the TFC org) should match.

### After STAGING.md Step 9 (pnpm install)

Must run at the **repo root**, not inside `infra/`. Terraform's `pnpm db:migrate` invocation looks for `node_modules/` at the project root, not the env directory.

### During STAGING.md Step 10 (terraform apply)

**Apply order matters: shared first, then staging.** Staging reads shared's outputs via `terraform_remote_state` — reversing fails with "remote state not found".

**Both `.envrc` files must be sourced before apply.**

```bash
source ../shared/.envrc   # provider auth, Vercel team ID, GitHub PAT
source .envrc             # Clerk, Resend, R2, Rollbar, frontend domain
```

Symptom of missing source: `Error: provider authentication failed` or `Error: variable "X" not set`.

**First Render deploy fails on service creation — expected.** The env group isn't linked yet at the moment Render creates the service. Terraform automatically triggers a second deploy via REST API after linking; that one comes up healthy. Don't intervene.

**Apply hangs at `pnpm db:migrate`.** Render free-tier Postgres takes 30–60s to spin up its first connection. Wait it out before killing.

**Cloudflare R2 errors during apply.** If `enable_r2 = true` (default), the engineer must complete `docs/setup/integrations/R2_STORAGE.md` first to provision the Cloudflare API token + account ID into `shared/.envrc`. To skip for now: set `enable_r2 = false` in `terraform.tfvars`, re-apply, then flip it on later.

### During STAGING.md Step 11 (verify)

**`terraform apply` blocks until both deploys are live.** The Render and Vercel modules call `scripts/verify-deploy.ts`, which triggers each platform's deploy and polls its status API until the build finishes. Expect Terraform to sit on these steps for ~3–5 min (Render) and ~2–4 min (Vercel) — don't kill it. A failed deploy exits non-zero and aborts the apply; re-running picks up cleanly because the redeploy resource re-fires.

If apply does fail at the verify step, the build logs live at:
- **Render Dashboard → project → staging** — per-service deploy logs
- **Vercel Dashboard → project → Deployments** — per-deploy streaming build logs

Transient 5xx from the Render or Vercel APIs can fail the local-exec without retry. Re-running `terraform apply` is the documented recovery path.

Once apply returns successfully, open the `frontend_url` from the output and run the Clerk auth flow end to end. If sign-in fails:
- Confirm `staging/.envrc` has the **test** Clerk keys (`pk_test_...` / `sk_test_...`), not live keys
- Confirm `CORS_ORIGIN` in the Render env group matches the Vercel URL exactly — Terraform sets it from `frontend_domain`; if the engineer changed `frontend_domain` mid-apply it can drift

### Production deltas (PRODUCTION.md Step 6)

When walking through production, flag the differences vs. staging:
- **Paid plans required**: `postgres_plan = "basic_256mb"`, `redis_plan = "starter"`, `web_service_plan = "starter"` (no cold starts). Free Postgres expires after 30 days, so production cannot use it.
- **Live Clerk keys**: `pk_live_...` / `sk_live_...` from Clerk's Production application, not the test keys staging uses. Reusing staging keys is a common mistake — Clerk will silently route auth at the wrong instance.

Production reuses the `<project>-shared` workspace's outputs via `terraform_remote_state`, so `shared/.envrc` and the Vercel + Render parent projects are already in place.

---

## Phase 4 Complete

When `terraform apply` succeeds in both `shared` and the target env workspace, both dashboards show healthy deploys, and the Clerk auth flow completes end to end at the deployed `frontend_url`.

**What's next:** Optional integrations in `docs/setup/integrations/` — `CUSTOM_DOMAIN.md`, `ENABLE_WORKER.md`, `R2_STORAGE.md`, `ROLLBAR.md`, `MIXPANEL.md`, `CODECOV.md`, `REPO_SECURITY.md`. Each is independent — pick what the project needs.
