# Genesis 2 Infrastructure (Terraform)

This is a spike (GENESIS-148) that codifies Genesis 2 infra provisioning across Render (backend + worker + Postgres + Key Value), Vercel (frontend), Cloudflare R2 (optional storage), and GitHub Actions (per-environment secrets). Only official Terraform providers are used. `staging` and `production` environments ship by default; any number of additional environments can be added by copying an existing env directory (see "Adding a new environment"). Only `staging` is validated end-to-end by this spike.

## First-time walkthrough (zero to running staging)

This is the complete path for someone who has never run this before. It covers every dashboard click and every command. Do staging first; other environments follow the same template.

### Prerequisites

- `git` and a clone of this repo
- `terraform` >= 1.6 (`brew install terraform` on macOS)
- Accounts you may need to create (free tiers work):
  - Render
  - Vercel
  - Cloudflare (only if you're using R2)
  - HCP Terraform / Terraform Cloud (state backend)
  - Clerk (auth)
  - Resend (transactional email)
  - Rollbar (optional, error tracking)
  - Codecov (optional, coverage)

### Step 1 - Create provider API tokens (one-time, per organization)

You only do this once per org. The same tokens are reused across all environments.

1. **Render API key**
   - Sign in at [dashboard.render.com](https://dashboard.render.com).
   - Account menu (top right) -> **Account Settings** -> **API Keys** -> **Create API Key**.
   - Label it `terraform`. Copy the value; you will not see it again.
2. **Render owner ID** (stored as `render_owner_id` in Terraform)
   - **Workspace Settings** -> **General**. The owner ID looks like `tea_xxx` (team) or `usr_xxx` (personal). Save it.
3. **Vercel token**
   - Sign in at [vercel.com](https://vercel.com).
   - Account avatar -> **Settings** -> **Tokens** -> **Create**.
   - Scope: your team. Expiration: whatever policy you prefer. Copy the value.
4. **Vercel team ID**
   - **Settings** -> **General** of the team. Team ID is a `team_xxx` string near the top. Save it.
5. **Cloudflare API token** (only if `enable_r2 = true`)
   - Sign in at [dash.cloudflare.com](https://dash.cloudflare.com).
   - My Profile -> **API Tokens** -> **Create Token** -> **Create Custom Token**.
   - Only one permission is needed: **Account** -> **Workers R2 Storage** -> **Edit**. Scope it to a single account resource. Do not use the "Edit Cloudflare Workers" template; it is over-scoped.
   - Save the token.
6. **Cloudflare account ID** (only if `enable_r2 = true`)
   - Account home page, right sidebar -> copy **Account ID**.
7. **GitHub fine-grained PAT**
   - Sign in at [github.com](https://github.com). Settings -> Developer settings -> **Personal access tokens (fine-grained)** -> **Generate new token**.
   - Repository access: **only this repo** (never "all repositories").
   - Permissions: **Actions: Read and write**, **Administration: Read and write** (required to create deployment environments), **Contents: Read**, **Metadata: Read**, **Secrets: Read and write**, **Variables: Read and write**.
   - Note: `Administration: Read and write` is broad - it allows the token to change repo settings. Scope the token to the single repo above, set a short expiration (30-90 days), and rotate on schedule. Do not reuse this token for anything else.
   - Copy the token.

### Step 2 - Create the Terraform Cloud organization and workspaces

Terraform needs somewhere to store its state. HCP Terraform (free tier) gives you encrypted remote state + locking + variable storage out of the box.

1. Sign up at [app.terraform.io](https://app.terraform.io) (free tier is fine).
2. Create an organization named `conrad-labs` (must match the value in `environments/*/backend.tf`; change both sides if you pick a different name).
3. Create one workspace per environment, all of type **CLI-Driven Workflow**:
   - `genesis-staging`
   - `genesis-production`
   - (add more later as you add environments - see "Adding a new environment" below)
4. For each workspace -> **Settings** -> **Execution Mode** -> set to **Local** (runs on your machine) or **Remote** (runs in TF Cloud). Local is simpler to start.
5. Log in from your terminal once: `terraform login` and follow the prompt to generate an API token. This is a one-time step per machine.

### Step 3 - Create Clerk + Resend accounts

Clerk is required (auth). Resend is optional but recommended (transactional email). Both are per-environment: create a separate Clerk application and a separate Resend sender per env.

1. **Clerk** (required)
   - Sign in at [dashboard.clerk.com](https://dashboard.clerk.com). Create an application named something like `genesis-staging`.
   - In the new application -> **API Keys**. Copy both the **Publishable key** (`pk_test_...`) and the **Secret key** (`sk_test_...`).
2. **Resend** (optional - skip to start with email disabled)
   - Sign in at [resend.com](https://resend.com). Create an API key under **API Keys**. Verify a sender domain under **Domains** (or start with their test domain for non-prod).
   - If you skip this, leave `resend_api_key` empty in Step 4 and email-sending endpoints will no-op.

### Step 4 - Populate TF Cloud workspace variables for staging

In the `genesis-staging` workspace -> **Variables** tab, add these as **Terraform variables** (not environment variables). Mark every secret as **Sensitive**.

Required (mark sensitive):
- `render_api_key`
- `vercel_api_token`
- `cloudflare_api_token` (only if `enable_r2 = true`)
- `github_token`
- `clerk_publishable_key`
- `clerk_secret_key`

Optional (mark sensitive):
- `resend_api_key` (leave empty to disable email)

Required (not sensitive):
- `github_owner`: e.g. `Conrad-Labs`
- `github_repository`: e.g. `project-genesis-2.0`
- `render_owner_id`: the `tea_xxx` value from Step 1.2
- `render_repo_url`: full GitHub URL, e.g. `https://github.com/Conrad-Labs/project-genesis-2.0`
- `vercel_team_id`: from Step 1.4
- `vercel_git_repo`: `Conrad-Labs/project-genesis-2.0`
- `cloudflare_account_id` (only if `enable_r2 = true`)

Leave the R2 / Rollbar / Codecov variables empty for now if you're not enabling those integrations on day 1. See "Progressive enablement" below for turning them on later.

### Step 5 - First plan and apply

```bash
cd infra/environments/staging
terraform init          # downloads providers + links to the TF Cloud workspace
terraform validate      # catches typos and provider-schema drift before any remote call
terraform plan          # shows what will be created
terraform apply         # creates everything; answer `yes` when prompted
```

The first apply takes a few minutes (Postgres + Key Value provisioning is the slow part). At the end, you'll see outputs: `server_url`, `web_url`, `github_environment`, `r2_bucket`.

Database migrations run automatically on every deploy via Render's pre-deploy hook. The default command is `pnpm --filter @genesis/server db:migrate`; override with the `server_pre_deploy_command` variable per environment, or set it to `""` to skip (e.g. for a database that is seeded via a one-off job instead). If the migration fails, Render aborts the deploy and the previous version keeps serving traffic.

### Step 6 - First deploy

Terraform creates the services but does not push code.

- **Render** auto-deploys on service creation. Expect the very first deploy to cycle once: it boots before the env group is linked, fails `@t3-oss/env-core` validation, and then auto-redeploys ~60s later with the full environment. See "Env-var dependency graph" below for the full story. Subsequent deploys are single-shot.
- **Vercel** connects the repo but does not build until the first push after project creation. Trigger a build one of two ways:
  - Push an empty commit: `git commit --allow-empty -m "chore(infra): trigger first staging deploy" && git push`, or
  - Vercel dashboard -> project -> **Deployments** -> **Redeploy** -> pick a commit.

### Step 7 - Verify

- `curl https://<server_url>/healthz` - backend should respond.
- Open `<web_url>` - Next.js app should load.
- Sign in with a Clerk test account - auth round-trip should work.
- Check GitHub -> your repo -> **Settings** -> **Environments** - a `staging` environment should exist with the secrets/variables TF wrote.

### Step 8 - Repeat for production

> **Before you start:** the GitHub branch used as `var.branch` (default `main`) must already be configured as a **protected branch** under Settings -> Branches. The `deployment_branch_policy { protected_branches = true }` on the production GitHub environment only allows deploys from branches that are currently protected, so if `main` is not protected yet, every deploy to the production environment will be blocked silently. Recommended protection: require PR + 1 approval + passing checks, then apply.

Same shape as staging, with two extra required inputs:

1. **Populate the `genesis-production` TF Cloud workspace variables.** Repeat Step 4 against the `genesis-production` workspace. (Step 4 only covered staging.) Values are per-environment - use a separate Clerk app, separate Resend sender, separate R2 access keys, etc.
2. **Set `github_reviewer_user_ids`** (required for production, enforced by a precondition in the platform module). These are numeric GitHub user IDs that must approve every deploy to the production GitHub environment. Look up a user's ID from their login:
   ```bash
   gh api /users/<github-login> --jq .id
   ```
   Set `github_reviewer_user_ids = [12345, 67890]` in the production workspace variables (as a plain Terraform variable, not sensitive).
3. Apply:
   ```bash
   cd infra/environments/production
   terraform init
   terraform plan
   terraform apply
   ```

## Reference

### Layout

```
infra/
├── modules/
│   ├── platform/       <- top-level composition; calls the others
│   ├── render/         <- web service, background worker, Postgres, Key Value, env group
│   ├── vercel/         <- project, env vars, (optional) custom domain
│   ├── cloudflare-r2/  <- optional R2 bucket
│   └── github/         <- per-environment repo secrets + variables
└── environments/
    ├── staging/
    └── production/
```

Each environment root is a thin wrapper that configures providers, pins to a TF Cloud workspace, and instantiates the `platform` module with env-specific inputs.

### Providers (official only)

| Service | Provider | Version |
|---|---|---|
| Render | `render-oss/render` | `~> 1.7` |
| Vercel | `vercel/vercel` | `~> 2.15` |
| Cloudflare | `cloudflare/cloudflare` | `~> 5.0` |
| GitHub | `integrations/github` | `~> 6.0` |

No community providers. Clerk, Resend, Rollbar, and Codecov accounts/keys are created **manually** in their respective dashboards; Terraform only wires the tokens into Render + Vercel env vars and GitHub Actions secrets.

### Master switches and skip flags

Three tiers of boolean controls, from coarsest to finest:

| Tier | Variable | Default | When `false` |
|---|---|---|---|
| Environment | `enabled` | `true` | Next apply destroys **everything** in the env (modulo `prevent_destroy` on Postgres and R2 - see "Removing an environment"). |
| Service | `service_enabled` | `true` | Render web + worker and the Vercel project are destroyed. Postgres, Key Value, R2, and the shared env group are preserved. Use to pause traffic without losing data. |
| Integration | `enable_worker` | `true` | No Render background worker. |
| Integration | `enable_r2` | `true` | No R2 bucket, no `S3_*` env vars on the backend. |
| Integration | `enable_rollbar` | `false` | No Rollbar env vars on Render/Vercel. |
| Integration | `enable_codecov` | `false` | No `CODECOV_TOKEN` on GitHub Actions. |

Cross-variable preconditions (enforced in `modules/platform/main.tf`) fail `terraform plan` at the input boundary when required companions are missing:
- `enable_r2 = true` requires `cloudflare_account_id`, `r2_access_key_id`, `r2_secret_access_key`.
- `enable_rollbar = true` requires `rollbar_server_token` and `rollbar_client_token`.
- `enable_codecov = true` requires `codecov_token`.
- `environment = "production"` requires at least one entry in `github_reviewer_user_ids`.

### Env-var dependency graph

This section documents how each environment variable is computed, which provider it is written to, and when it becomes available. Understanding this is important because Terraform's apply order is not the same as the order in which Render / Vercel see the new values.

#### Where each env var is written

**Render backend service (direct `env_vars` on the resource)**
- `DATABASE_URL` - from `render_postgres.main.connection_info.internal_connection_string` (intra-region private network). Available on first deploy.
- `REDIS_URL` - from `render_keyvalue.main.connection_info.internal_connection_string` (intra-region private network). Available on first deploy.
- `PORT` - literal, configurable via `server_port` variable. Default `10000`.

**Render shared env group (`render_env_group.shared.env_vars`, linked to both web + worker via `render_env_group_link`)**
- `NODE_ENV` - hardcoded to `production` for every deployed environment (only local development runs with `NODE_ENV=development`).
- `LOG_LEVEL` - `info`.
- `CORS_ORIGIN` - computed deterministically from `"${app_name}-${environment}-web.vercel.app"`, or from `var.vercel_domain` if set. Stable across `service_enabled` flips.
- `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` - from workspace variables.
- `RESEND_FROM_EMAIL`, `RESEND_API_KEY` - from workspace variables.
- `ROLLBAR_SERVER_TOKEN` - from workspace variable, only when `enable_rollbar = true`.
- `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` - only when `enable_r2 = true`. Bucket name and endpoint come from the R2 module; access keys from workspace variables (created manually in Cloudflare).
- `S3_REGION` - hardcoded to `"auto"` (R2's only supported region); only when `enable_r2 = true`.

**Vercel Next.js project (`vercel_project_environment_variable`)**
- `NEXT_PUBLIC_SERVER_URL` - from `render_web_service.backend[0].url`. Null when `service_enabled = false`.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL` - from workspace variables.
- `NEXT_PUBLIC_NODE_ENV` - mirrors Render's `NODE_ENV` (always `production` for deployed envs).
- `NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN` - only when `enable_rollbar = true`. Written as a Vercel secret env var (sensitive), not as a plain var.

**GitHub Actions environment (`github_actions_environment_secret` + `github_actions_environment_variable`, scoped to the `<env>` GitHub environment)**
- Secrets:
  - `RENDER_SERVER_SERVICE_ID`, `VERCEL_PROJECT_ID` - set when `service_enabled = true`.
  - `RENDER_WORKER_SERVICE_ID` - set when `enable_worker = true` AND `service_enabled = true`.
  - `CODECOV_TOKEN` - set when `enable_codecov = true`.
- Variables (non-secret):
  - `APP_ENVIRONMENT` - always set (`qa`, `staging`, `production`, etc).
  - `SERVER_URL`, `WEB_URL` - set when `service_enabled = true`, from Render and Vercel outputs.

#### Cross-provider dependencies

```
render_postgres  ┐
render_keyvalue  ┤  -> DATABASE_URL, REDIS_URL on web + worker (direct env_vars)
render_env_group ┘
       │
       │  linked by render_env_group_link after services exist
       ▼
render_web_service ───────-> NEXT_PUBLIC_SERVER_URL on Vercel
render_background_worker
       │
       │  outputs
       ▼
github_actions_environment_secret (RENDER_*_SERVICE_ID)

vercel_project ──────────-> CORS_ORIGIN, SERVER_URL/WEB_URL GitHub variables
    (hostname is deterministic from app_name + environment, so CORS_ORIGIN
     is computed without waiting for the Vercel resource to exist)

cloudflare_r2_bucket ─────-> S3_BUCKET, S3_ENDPOINT on Render (when enable_r2 = true)
```

#### Timing: when do new values become live?

- **Render backend, direct `env_vars`** (DATABASE_URL, REDIS_URL, PORT): baked into the service definition at creation. Available immediately on first deploy.
- **Render env group** (Clerk, Resend, etc.): attached by `render_env_group_link` **after** the service resource is created. On the very first `terraform apply`, Render starts a deploy as soon as the service exists, which briefly boots without env-group variables and fails `@t3-oss/env-core` validation. Render then detects the env group link and auto-redeploys with the full environment - typically within 60 seconds. First deploy is expected to cycle once; subsequent deploys are single-shot.
- **Vercel env vars**: written synchronously when the project is created. **Vercel does not auto-redeploy on env-var change.** Token rotations or toggling `enable_rollbar` require a manual redeploy trigger (empty commit, Vercel dashboard "Redeploy", or a deploy hook).
- **GitHub Actions secrets / variables**: available to the next workflow run that targets the matching environment. No redeploy concept.

#### Migration timing

Both the web service and the worker have `pre_deploy_command = "pnpm --filter @genesis/server db:migrate"` by default. Render runs pre-deploy commands before swapping traffic; if the migration fails, the deploy aborts and the previous version keeps serving. Drizzle migrations are idempotent, so running them on both services is safe (it closes a race where the worker could otherwise boot against an unmigrated schema on first apply).

Override per environment via `server_pre_deploy_command`. Set to `""` to skip migrations entirely (e.g. for a preview environment that uses a disposable DB).

## Operational recipes

### Running against HCP Terraform vs. local state

The default setup uses HCP Terraform (formerly Terraform Cloud) as the state backend. This is the right choice for team use: encrypted remote state, locking, run history, and secret variables all out of the box. But Terraform also works fine with a local state file, which is convenient for solo development or throwaway experimentation.

The `cloud {}` block in each environment's `backend.tf` is the only thing that decides which mode you use.

#### Option A - HCP Terraform (default, recommended for shared environments)

Keep `backend.tf` as shipped. Follow Step 2 of the walkthrough to create the organization + workspace + log in. State is stored remotely; any teammate who runs `terraform init` with the same credentials reuses it.

#### Option B - Local state (solo / experimental)

Delete or comment out the `cloud {}` block in the env's `backend.tf`:

```hcl
# environments/staging/backend.tf

# terraform {
#   cloud {
#     organization = "conrad-labs"
#     workspaces {
#       name = "genesis-staging"
#     }
#   }
# }
```

Or just delete the file entirely. Terraform falls back to local state (`terraform.tfstate` in the env directory). This file is already gitignored by the top-level `.gitignore`. Secrets still need to exist somewhere; when there is no TF Cloud workspace to hold them, use a local `terraform.tfvars` file (also gitignored):

```bash
cd environments/staging
cp terraform.tfvars.example terraform.tfvars   # edit with real values
terraform init
terraform plan
terraform apply
```

#### Switching between them later

- **HCP -> local**: `terraform state pull > local.tfstate`, remove the `cloud {}` block, run `terraform init -migrate-state` and point at the pulled file.
- **Local -> HCP**: add the `cloud {}` block back, run `terraform init` and answer "yes" when prompted to migrate state up to HCP.

#### Caveats of local mode

- No locking. Running two applies concurrently can corrupt state. Only safe for one person at a time.
- Secrets end up in `terraform.tfvars` on disk; treat that file like you would a `.env` with real keys.
- No run history. If you need to know who applied what and when, use HCP.

### Progressive enablement (turning integrations on later)

You do not need Rollbar, Codecov, or R2 ready on day 1. Provision the core first, then enable each optional integration when its account/keys exist. The skip flags are designed for exactly this.

#### Bootstrap order without all integrations ready

1. Create the always-required account (Clerk) and Resend if you want email; paste keys into the TF Cloud workspace variables.
2. First apply with optional flags off:
   ```hcl
   enable_worker  = true   # or false if you aren't using BullMQ yet
   enable_r2      = false
   enable_rollbar = false
   enable_codecov = false
   ```
3. App is live on Render + Vercel with Clerk (+ optional Resend) wired.

#### Enabling an integration later

Generic flow: create the account, paste the tokens into TF Cloud workspace variables, flip the flag, `apply`.

##### Rollbar
1. Create the project in the Rollbar dashboard, grab `post_server_item` and `post_client_item` tokens.
2. In the TF Cloud workspace, set `rollbar_server_token` and `rollbar_client_token` (both sensitive).
3. Flip `enable_rollbar = true`, `terraform apply`.
4. Render auto-redeploys on env-var change. **Vercel does not** - trigger a redeploy manually (empty commit, Vercel deploy hook, or re-trigger latest deployment in the Vercel UI).

##### Codecov
1. Install the Codecov GitHub App on the repo.
2. Copy the upload token from the Codecov dashboard.
3. Set `codecov_token` (sensitive) in TF Cloud, flip `enable_codecov = true`, `apply`.
4. Next CI run picks up the new `CODECOV_TOKEN` GitHub Actions secret. No Render/Vercel redeploy involved.

##### R2 (two applies)
R2 needs the bucket before the access key can be scoped to it, so this is a two-step flow:
1. Flip `enable_r2 = true`, leave `r2_access_key_id` / `r2_secret_access_key` empty, `apply`. TF creates the bucket.
2. In the Cloudflare dashboard: R2 -> Manage R2 API Tokens -> create token scoped to the new bucket.
3. Paste Access Key ID + Secret into the TF Cloud workspace vars.
4. `apply` again. TF wires `S3_*` env vars on Render.
5. Render auto-redeploys. The backend now uploads to R2 on next request.

##### Worker
If you started with `enable_worker = false` and want BullMQ now:
1. Flip `enable_worker = true`, `apply`. Render provisions the background worker service and wires it to the shared env group, Postgres, and Key Value.
2. No dashboard step needed.

#### Disabling an integration

Flipping a flag back to `false` triggers destruction of its resources on next `apply`.

- `enable_rollbar = false` -> Rollbar env vars removed from Render + Vercel (tokens stay in TF vars, unused).
- `enable_codecov = false` -> `CODECOV_TOKEN` removed from GitHub Actions secrets.
- `enable_r2 = false` -> **Bucket is destroyed.** Objects are deleted. Take a backup first or the data is gone. (Guarded by `prevent_destroy` - see "Removing an environment".)
- `enable_worker = false` -> Worker service destroyed. Pending BullMQ jobs are lost unless drained first.

#### Rotating a token without downtime

Same flow whether the integration is newly enabled or already live: update the TF Cloud workspace variable, `apply`. The Render env group is updated in place, Render redeploys. Vercel needs a manual redeploy trigger for the new value to take effect.

### Adding a new env var to the app

1. Add the var to the app's `env.ts` and `.env.example` per the `cl-adding-environment-variable` skill.
2. If it's a non-secret platform-level value, add it to the `env_vars` map in `modules/platform/main.tf` (`local.server_env_vars` or `local.web_env_vars`).
3. If it's a secret, add a variable to `modules/platform/variables.tf` (marked `sensitive = true`) and merge it into `local.server_secret_env_vars` (server) or `local.web_secret_env_vars` (web).
4. Expose the variable through each environment root (`environments/*/variables.tf` and the module call in `main.tf`).
5. Set the value as a sensitive workspace variable in TF Cloud per environment.

### Adding a new environment

The layout is designed to support any number of environments (QA, UAT, demo, per-developer, etc.). To add one named `qa`:

1. **Copy an existing environment directory**:
   ```bash
   cp -R environments/staging environments/qa
   ```
2. **Update `environments/qa/main.tf`**: change the hard-coded `environment = "staging"` string to `environment = "qa"` in the `module "platform"` block. (Leave everything else alone - all other values flow from variables.)
3. **Update `environments/qa/backend.tf`** (only if using HCP Terraform): change the workspace name to something unique, e.g. `name = "genesis-qa"`.
4. **Update `environments/qa/variables.tf`**: change the `default` on the `branch` variable to the git branch this environment should track (e.g. `"develop"` for a QA tracking dev; `"qa"` for a dedicated QA branch).
5. **Create the HCP Terraform workspace** (only if using HCP): go to your TF Cloud org, create a CLI-driven workspace named to match step 3, add all the sensitive workspace variables from `terraform.tfvars.example`.
6. **Optional - custom domain**: set `vercel_domain = "qa.example.com"` in the workspace or tfvars file, and add a matching DNS record pointing at Vercel.
7. **Optional - disable heavy services**: for a lightweight env (e.g. a preview or per-developer stack), start with `enable_worker = false`, `enable_r2 = false`, `enable_rollbar = false`, `enable_codecov = false` to save cost.
8. **Apply**:
   ```bash
   cd environments/qa
   terraform init
   terraform plan
   terraform apply
   ```

The `environment` variable accepts any lowercase kebab-case name (validated by regex), so names like `qa`, `uat`, `demo`, `preview-42`, or `staging-eu` are all valid. Render will create a separate project per environment; Vercel will create a separate project; GitHub will create a separate Actions environment. Nothing is shared across environments.

### Removing an environment

`prevent_destroy` is set on `render_postgres.main` and `cloudflare_r2_bucket.main` so accidental destroys are blocked with `Instance cannot be destroyed`. Postgres has no per-service enable flag (it is always provisioned and only goes away on full-environment teardown). R2 is gated by `enable_r2`; flipping it from `true` to `false` schedules the bucket for destruction, which `prevent_destroy` then blocks until the teardown dance below is followed. The full teardown dance is:

1. Snapshot the Postgres DB (Render dashboard -> service -> Backups) and download anything important from the R2 bucket.
2. Temporarily remove the `lifecycle { prevent_destroy = true }` blocks from `infra/modules/render/main.tf` (on `render_postgres.main`) and `infra/modules/cloudflare-r2/main.tf` (on `cloudflare_r2_bucket.main`). Commit-or-don't is fine; you will revert.
3. Flip `enabled = false` in the env's workspace variable (or tfvars), `terraform apply`. Terraform now tears down everything including the database and bucket.
4. Restore the `prevent_destroy` blocks so the next environment isn't unguarded.
5. `rm -rf environments/<name>` and delete the corresponding HCP Terraform workspace.

## Known limitations of this spike

- Render provider resource names are verified against `render-oss/render ~> 1.7` (pinned in `versions.tf`). Future provider releases may rename fields; re-run `terraform validate` after a provider upgrade.
- **Render plan strings** (`starter`, `basic_256mb`, `free`) are the defaults in this module but Render occasionally renames them. Confirm the current list at [render.com/docs/pricing](https://render.com/docs/pricing) before first apply and override via `render_server_plan` / `render_postgres_plan` / `render_key_value_plan` / `render_worker_plan` variables if needed.
- **One Render project is created per Terraform environment.** Each env root provisions its own `render_project` containing exactly one Render environment. This keeps the TF env roots fully independent at the cost of one extra project in the Render workspace. The alternative (one project with N environments) is possible but would require a separate bootstrap module and cross-workspace state sharing.
- **First-deploy cycle on fresh apply**: see "Env-var dependency graph" above. Expect Render's first deploy to fail env validation briefly, then auto-redeploy ~60s later once the env group is linked. This is normal; it only happens on the very first apply per environment.
- Cloudflare R2 access keys cannot be provisioned by the Cloudflare provider; this is the single documented manual step.
- Rollbar uses TF-wired tokens only (no TF-managed projects) to honor the "official providers only" rule. If that rule relaxes, a community provider exists.
- DNS for custom domains is not managed here. If you want Cloudflare DNS records for the Vercel domain, add a small `cloudflare_record` block to the Vercel module.
