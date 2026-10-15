# Setting Up the Production Environment with Terraform

This document covers the **production** environment. Set up staging first via [`STAGING.md`](STAGING.md).

---

## Step 1 — Things you don't need to redo

If you followed [`STAGING.md`](STAGING.md), these are already done:

- ✅ Client-owned dev identity (used for every third-party service signup)
- ✅ Terraform CLI installed (1.7+)
- ✅ Render account + payment method
- ✅ Render GitHub App installed on the org with access to the repo
- ✅ Vercel account + GitHub App installed on the org
- ✅ Terraform Cloud account, `terraform login` complete
- ✅ Personal Render API key + Render Owner ID
- ✅ Vercel API token + team ID
- ✅ GitHub PAT with `repo` scope
- ✅ Cloudflare API token + Account ID (set in `shared/.envrc` when you set up staging R2)
- ✅ **`<project>-shared` TFC workspace applied** (owns the Vercel + Render projects; production reads its outputs via `terraform_remote_state`)
- ✅ `infra/terraform/envs/shared/.envrc` populated and on disk

---

## Step 2 — Set up the production `.envrc`

```bash
cd /path/to/project/infra/terraform/envs/production
cp .envrc.example .envrc
```

Production reuses `shared/.envrc` for everything that's the same across envs.

Open `production/.envrc` and fill in:
- **Vercel platform options** — `TF_VAR_frontend_domain`.
- **Required (Clerk)** — paste your `sk_live_...` and `pk_live_...` from Clerk Dashboard's **Production** application (NOT the test keys from staging).
- **Server-only / Client-only** — production-tier integrations (different Resend domain, Rollbar). Leave as `""` for anything not in use.

The remaining decisions are deploy-time defaults to be aware of before you run apply:

> **Custom domain.** `TF_VAR_frontend_domain` is empty by default — Terraform auto-generates a stable `*.vercel.app` URL. Once you verify the stack is healthy, attach the client's real domain via [`integrations/CUSTOM_DOMAIN.md`](integrations/CUSTOM_DOMAIN.md).

> **Worker.** The BullMQ worker is disabled by default (`enable_worker = false` in `terraform.tfvars`). It costs ~$7/mo on Render. To enable it, follow [`integrations/ENABLE_WORKER.md`](integrations/ENABLE_WORKER.md).

> **R2 storage.** Cloudflare R2 file storage is enabled by default (`enable_r2 = true` in `terraform.tfvars`). Production needs its own API token scoped to the production bucket — before applying, complete the credential setup in [`integrations/R2_STORAGE.md`](integrations/R2_STORAGE.md). To skip for now, set `enable_r2 = false`; you can flip it back later and re-run `terraform apply`.

---

## Step 3 — Create the production TFC workspace

In the Terraform Cloud UI:

1. **New** (top right) → **Workspace**.
2. Choose **CLI-driven workflow**.
3. **Project**: same project you used for staging.
4. **Workspace name**: must match `workspaces.name` in `infra/terraform/envs/production/backend.tf` exactly (e.g., `<project>-production`).
5. Create.
6. **Settings → General → Execution Mode → Local → Save**.

---

## Step 4 — Confirm Terraform values match your setup

`pnpm rename` already populated these, but it's worth a 30-second check before you apply. Open these two files and confirm every value matches what you just set up:

**`infra/terraform/envs/production/backend.tf`:**

```hcl
terraform {
  cloud {
    organization = "<your-tfc-org>"          # same as staging
    workspaces {
      name = "<your-project>-production"     # must match the workspace name from Step 3
    }
  }
}
```

**`infra/terraform/envs/production/terraform.tfvars`:**

```hcl
project_name     = "<your-project>"
environment      = "production"
postgres_plan    = "basic_256mb"             # paid plan — free Postgres expires after 30 days
redis_plan       = "starter"                 # paid plan
web_service_plan = "starter"                 # paid plan — no cold starts
```

`repo_url` and the per-env branches live in `envs/shared/terraform.tfvars` — already verified during staging setup.

Edit anything that doesn't match. Commit + push if you make changes.

---

## Step 5 — Hydrate `node_modules`

Only if you haven't already from staging:

```bash
cd /path/to/project
pnpm install
```

---

## Step 6 — Plan and apply

```bash
cd /path/to/project/infra/terraform/envs/production
source ../shared/.envrc   # provider auth
source .envrc             # production-specific values
terraform init
terraform plan -out=production.tfplan
terraform apply production.tfplan
```

Expected: ~5–10 minutes. The shared workspace (Vercel + Render projects) is already in place from when you set up staging — production reads its IDs via `terraform_remote_state` and only creates env-scoped resources here.

What's different from staging:

- Postgres uses `basic_256mb` (paid plan) instead of `free` — required because free Postgres expires after 30 days
- Redis uses `starter` (paid plan)
- Web service uses `starter` (paid plan) — no cold starts

---

## Step 7 — Verify

`terraform apply` doesn't exit until both builds are live. The Render and Vercel modules call `scripts/verify-deploy.ts`, which triggers each platform's deploy and polls its status API until the build finishes. Expect Terraform to sit on these steps for ~3–5 min (Render) and ~2–4 min (Vercel).

If a deploy fails or times out, the corresponding step exits non-zero and `terraform apply` fails. Inspect logs at:
- **Render Dashboard → your project → production** — services list + per-service deploy logs.
- **Vercel Dashboard → your project → Deployments** — per-deploy streaming build logs.

After fixing the cause, re-run `terraform apply` — the redeploy resource will re-trigger and re-poll.

> **Transient network errors / 5xx from Render or Vercel APIs** can occasionally fail the local-exec on the first try. The script doesn't retry on purpose — just re-run `terraform apply` and it'll pick up cleanly.

### Frontend loads

Once apply returns successfully, open the `frontend_url` from the output and sign in via Clerk using a **production** Clerk account (separate from staging).

