# Adding a New Environment

Use this guide when you want a third (or fourth) environment beyond `staging` + `production` — for example, a `qa` env that tracks its own branch.

## Steps

### 1. Append the new env name to all three module validators

Each module has an `environment` variable that validates against an allow-list. Add the new name to all three so plan accepts it:

- `infra/terraform/modules/render/variables.tf` (`environment` validation `contains([...])`)
- `infra/terraform/modules/vercel/variables.tf` (same key)
- `infra/terraform/modules/github/variables.tf` (same key)

```hcl
condition = contains(["staging", "production", "qa"], var.environment)
```

### 2. Copy `staging` as the starting point, then re-point `variables.tf` at the canonical file

```bash
cp -r infra/terraform/envs/staging infra/terraform/envs/qa
rm infra/terraform/envs/qa/variables.tf
ln -s ../staging/variables.tf infra/terraform/envs/qa/variables.tf
```

The canonical per-env variable schema lives in `envs/staging/variables.tf`; every other per-env root (production, qa, …) symlinks to it so a single edit covers all envs. The `cp -r` step copies a regular file by default — the explicit `rm` + `ln -s` keeps the new env on the canonical schema.

### 3. Edit `qa/backend.tf`

```hcl
workspaces {
  name = "<project>-qa"
}
```

### 4. Edit `qa/terraform.tfvars`

```hcl
environment      = "qa"
branch           = "qa"            # or whatever git branch this env tracks
postgres_plan    = "free"          # staging-tier; bump to a paid plan if qa needs persistence past 30 days
redis_plan       = "free"
web_service_plan = "free"
enable_worker    = false           # see STAGING.md Step 3 — Worker callout
enable_r2        = true            # see STAGING.md Step 3 — R2 storage callout
```

Adjust the plan tiers and feature flags per the env's needs. The Worker / R2 callouts in STAGING.md Step 3 explain when to flip these.

### 5. Create the matching git branch

```bash
git checkout develop
git pull
git checkout -b qa
git push -u origin qa
```

Add branch protection rules on GitHub (**Settings → Branches**) — same shape as `develop` / `main`.

### 6. Update `.github/workflows/deploy.yml`

Add the new branch to the trigger list and the environment expression:

```yaml
on:
  push:
    branches: [main, develop, qa]

jobs:
  deploy:
    environment: ${{ github.ref_name == 'main' && 'production' || github.ref_name == 'qa' && 'qa' || 'staging' }}
```

### 7. Set up the new env

Follow [`STAGING.md`](STAGING.md) from **Step 7 (Terraform Cloud workspace)** onward, substituting `qa` for `staging` everywhere. The provider tokens, accounts, and GitHub PAT you already generated for staging cover this env too.
