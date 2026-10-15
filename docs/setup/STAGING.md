# Setting Up the Staging Environment with Terraform

This document walks you through setting up the **staging** environment end to end. Once staging works, follow [`PRODUCTION.md`](PRODUCTION.md) to add production.

---

## Step 1 — Client-owned dev identity

Before signing up for anything, set up a single client-owned account that you'll use to sign up for **every third-party service this project depends on** — no exceptions. That includes the deploy stack (GitHub, Render, Vercel, Terraform Cloud, Cloudflare) and every integration the app talks to (Clerk, Resend, Rollbar, and anything you wire in later). One identity across the whole stack — when engineers rotate off the project, this identity stays and nothing breaks.

1. Ask client for a shared dev email eg. `dev@<client-domain>.com`
2. **Use this email for every signup** in the steps that follow, and for any future integration you add.
3. For GitHub specifically: create the account with this email if one doesn't already exist, and add it to the client's GitHub org with **admin** access on the project repo.

> **Why this matters.** Most service API tokens (GitHub PATs, Vercel tokens, Render keys, etc.) are user-scoped, not org-scoped. If a token is generated from an individual engineer's account and that engineer later leaves, the token dies and the deploy or integration breaks. Tying every service account to a single client-owned identity survives engineer rotation across the whole stack.

---

## Step 2 — Install Terraform

```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform tflint
```

Or download a binary from [https://releases.hashicorp.com/terraform/](https://releases.hashicorp.com/terraform/). You need version **1.7 or later**.

Verify:

```bash
terraform version
```

---

## Step 3 — Set up `.envrc` files

There are **two layered** `.envrc` files. Both gitignored.

- `infra/terraform/envs/shared/.envrc` — values shared across every env eg. Render, Vercel, GitHub. Sourced when applying any workspace.
- `infra/terraform/envs/staging/.envrc` — env-specific values eg. Clerk staging keys, Resend, R2, Rollbar, frontend domain.

Set up both now so you've got a place to paste each secret as you generate it in Steps 3–5:

```bash
cd /path/to/project/infra/terraform/envs/shared
cp .envrc.example .envrc

cd ../staging
cp .envrc.example .envrc
```

Fill in `shared/.envrc` as you complete Steps 3–5.

`staging/.envrc` is grouped by what each value does:

- **Vercel platform options** — `TF_VAR_frontend_domain`.
- **Required (Clerk)** — paste your Clerk staging keys from Clerk Dashboard → API Keys.
- **Server-only / Client-only** — optional integrations (eg. Resend, Rollbar). Leave as `""` for anything you're not using; the app degrades gracefully.

The remaining decisions are deploy-time defaults to be aware of before you run apply:

> **Custom domain.** `TF_VAR_frontend_domain` is empty by default — Terraform auto-generates a stable `*.vercel.app` URL that's good enough to verify the stack. To attach a real domain, follow [`integrations/CUSTOM_DOMAIN.md`](integrations/CUSTOM_DOMAIN.md).

> **Worker.** The BullMQ worker is disabled by default (`enable_worker = false` in `terraform.tfvars`). It costs ~$7/mo on Render. To enable it, follow [`integrations/ENABLE_WORKER.md`](integrations/ENABLE_WORKER.md).

> **R2 storage.** Cloudflare R2 file storage is enabled by default (`enable_r2 = true` in `terraform.tfvars`). Terraform creates the bucket automatically — before applying, complete the credential setup in [`integrations/R2_STORAGE.md`](integrations/R2_STORAGE.md). To skip for now, set `enable_r2 = false`; you can flip it back later and re-run `terraform apply`.

---

## Step 4 — Render

### First-time account setup

1. Go to [render.com](https://render.com) and sign up using the **dev email from Step 1** (not GitHub login).
2. Add a payment method. Render requires a valid credit card on file **even for the free tier** before you can provision any services — you won't be charged on free plans, but the card is mandatory. Add it via **Workspace Settings → Billing → Payment Methods**.
3. Upgrade your workspace to **Professional** ($25/mo) or higher. You can do this later — Render's free Postgres gives you ~44 days (30-day lifetime + 14-day grace) before the database is deleted, and free web services just sleep on inactivity (no data loss). Upgrade anytime before the 30-day mark to keep the database and stop services from sleeping.

### Create a personal Render API key

Render is the first service Terraform talks to during apply. It needs an API key to authenticate.

1. In the Render Dashboard, search for **API Keys** (top search bar) and open that page → click **Create API Key**.
2. Copy the value — only shown once.
3. Paste it into **`shared/.envrc`** as `RENDER_API_KEY`.

### Get your Render Owner ID

The Terraform provider needs to know which Render team (or personal account) to provision resources into.

```bash
curl -s -H "Authorization: Bearer <PASTE_RENDER_API_KEY>" https://api.render.com/v1/owners
```

Copy the `id` field from the response. It looks like `tea-abc123...` (team) or `usr-...` (personal). Both work. Paste it into **`shared/.envrc`** as `RENDER_OWNER_ID`.

### Install the Render GitHub App on your org

1. Go to **https://github.com/apps/render**.
2. Click **Configure** (or **Install**).
3. Select the org or user that owns your repo.
4. Under **Repository access**, add your fork (or pick "All repositories").
5. **Save**.

---

## Step 5 — Vercel

### First-time account setup

1. Go to [vercel.com](https://vercel.com) and sign up using the **dev email from Step 1** (not GitHub login).
2. (Optional, can do later) Upgrade to a Pro account.

### Create a Vercel API token

1. In the Vercel Dashboard, search for **Tokens** (top search bar) and open that page → click **Create Token**.
2. **Scope**: **Full Account**.
3. **Expiration**: 1 year (or "no expiration" if you accept the rotation policy).
4. Copy the token — only shown once.
5. Paste it into **`shared/.envrc`** as `VERCEL_API_TOKEN`.

### Get your Vercel team ID (skip if you're on a personal account)

In the Vercel Dashboard, switch to the team in the top-left team picker → **Settings** → **General**. The **Team ID** (`team_...`) is shown near the top. Paste it into **`shared/.envrc`** as `TF_VAR_vercel_team_id`.

If you don't have a team (personal account), leave `TF_VAR_vercel_team_id` empty.

### Install the Vercel GitHub App on your org

1. Go to **https://github.com/apps/vercel**.
2. Click **Configure** (or **Install**).
3. Select the org or user that owns your repo.
4. Under **Repository access**, add your fork (or pick "All repositories").
5. **Save**.

---

## Step 6 — GitHub PAT

Terraform creates the GitHub Environment and the Actions secrets that `deploy.yml` reads at run time. It needs a Personal Access Token to manage them.

**Sign in to GitHub as the dev user from Step 1** before generating the token — the PAT inherits whoever generated it, so generating it from an individual engineer's account is what we're avoiding.

1. Go to **github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)** → **Generate new token (classic)**.
2. **Expiration**: 90 days.
3. **Scope**: tick **`repo`** only. That's enough for Environments and Secrets.
4. Click **Generate token** and copy the `ghp_...` value — only shown once.
5. Paste it into **`shared/.envrc`** as `GITHUB_TOKEN`.
6. Set `GITHUB_OWNER` in **`shared/.envrc`** to the org or user that owns the repo (e.g., `Conrad-Labs`).

---

## Step 7 — Terraform Cloud organization + workspace

Terraform stores the state of your infrastructure in Terraform Cloud (free tier covers 5 users + unlimited private workspaces).

### Sign up

Go to [app.terraform.io](https://app.terraform.io) and sign up. The signup flow asks you to **create an organization** — name it the same as your project (`<your-project-name>`).

> **Use the project name you set during local setup.** When you ran `pnpm rename <project-name>` in [`LOCAL_ENV.md`](LOCAL_ENV.md), the script wrote that name into `infra/terraform/envs/staging/backend.tf` as the TFC `organization` value. If you don't remember the name, open `infra/terraform/envs/staging/terraform.tfvars` and copy the value of `project_name` — use that as your TFC organization slug here so they match automatically.

If your team already has a TFC org, ask an admin for an invite instead — and note the org slug, you'll need to update `backend.tf` in the next step if it doesn't match your project name.

### Log the Terraform CLI in

```bash
terraform login
```

A browser opens; authorize and paste the token back into the CLI when prompted.

### Create a project (UI grouping)

1. **Projects** (left sidebar) → **+ New project**.
2. Name it after your project.
3. Click **Create**.

### Create the workspaces

Create **two TFC workspaces** in this doc — one for shared infrastructure, one for staging.

For each, do:

1. **New** (top right) → **Workspace**.
2. Choose **CLI-driven workflow**
3. **Project**: pick the project you just created.
4. **Workspace name**: must match `workspaces.name` in the matching `backend.tf` exactly:
   - **`<project>-shared`** matches `infra/terraform/envs/shared/backend.tf`
   - **`<project>-staging`** matches `infra/terraform/envs/staging/backend.tf`
5. Click **Create workspace**.
6. Click into the new workspace → **Settings** (left sidebar) → **General** → **Execution Mode** → **Local** → **Save**.

> **Why a separate shared workspace?** Both Vercel and Render put environments *inside* a project (Vercel: production + custom envs; Render: a project with one entry per env). The shared workspace owns those project-level resources, and staging/production reference them via `terraform_remote_state`. Destroying staging never destroys the parent project, and you can run any env independently after shared exists.

---

## Step 8 — Confirm Terraform values match your setup

`pnpm rename` already populated these, but it's worth a 30-second check before you apply. Open these three files and confirm every value matches what you just set up:

**`infra/terraform/envs/shared/backend.tf`:**

```hcl
terraform {
  cloud {
    organization = "<your-tfc-org>"          # must match the TFC org from Step 7
    workspaces {
      name = "<your-project>-shared"         # must match the shared workspace name from Step 7
    }
  }
}
```

**`infra/terraform/envs/shared/terraform.tfvars`:**

```hcl
project_name = "<your-project>"
repo_url     = "https://github.com/<your-org>/<your-repo>"
# environments map defaults to staging=develop + production=main; override only if needed
```

**`infra/terraform/envs/staging/backend.tf`:**

```hcl
terraform {
  cloud {
    organization = "<your-tfc-org>"          # same org
    workspaces {
      name = "<your-project>-staging"        # must match the staging workspace name from Step 7
    }
  }
}
```

Edit anything that doesn't match. Commit + push if you make changes.

---

## Step 9 — Hydrate `node_modules`

Terraform shells out to `pnpm db:migrate` during apply, so dependencies must be installed at the project root.

```bash
cd /path/to/project
pnpm install
```

---

## Step 10 — Plan and apply

**Apply shared first** (one-time — creates the Vercel + Render projects):

```bash
cd /path/to/project/infra/terraform/envs/shared
source .envrc
terraform init                       # downloads providers, connects to shared TFC workspace
terraform apply
```

Expected: ~30 seconds.

**Then apply staging:**

```bash
cd /path/to/project/infra/terraform/envs/staging
source ../shared/.envrc              # cross-env values: provider auth, Vercel team ID, GitHub PAT
source .envrc                        # env-specific values: Clerk, Resend, R2, Rollbar, frontend domain
terraform init                       # downloads providers, connects to staging TFC workspace
terraform plan -out=staging.tfplan
terraform apply staging.tfplan
```

Expected: ~5–10 minutes.

What's happening behind the scenes:

- Terraform creates the Render project, Postgres, Redis, web service
- Creates the Cloudflare R2 bucket (`<project>-staging`) and wires `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` into the Render env group automatically
- Runs Drizzle migrations against the new Postgres via `pnpm db:migrate`
- Creates the Vercel project, custom environment, env vars, deploy hook, and an auto-generated `*.vercel.app` URL
- Creates the GitHub Environment and secrets
- Triggers a fresh Render deploy with all env vars in place
- Triggers the first Vercel deploy

Render's first auto-deploy on service creation will fail (env group not linked yet) — that's expected. Terraform automatically triggers a second deploy via the REST API once the env group is linked, and that one comes up healthy.

---

## Step 11 — Verify

`terraform apply` doesn't exit until both builds are live. The Render and Vercel modules call `scripts/verify-deploy.ts`, which triggers each platform's deploy and polls its status API until the build finishes. Expect Terraform to sit on these steps for ~3–5 min (Render) and ~2–4 min (Vercel).

If a deploy fails or times out, the corresponding step exits non-zero and `terraform apply` fails. Inspect logs at:
- **Render Dashboard → your project → staging** — services list + per-service deploy logs.
- **Vercel Dashboard → your project → Deployments** — per-deploy streaming build logs.

After fixing the cause, re-run `terraform apply` — the redeploy resource will re-trigger and re-poll.

> **Transient network errors / 5xx from Render or Vercel APIs** can occasionally fail the local-exec on the first try. The script doesn't retry on purpose — just re-run `terraform apply` and it'll pick up cleanly.

### Frontend loads

Once apply returns successfully, open the `frontend_url` from the output. You should see the landing or sign-in page. Sign in via Clerk and navigate to the portal.
