# Updating Environment Variables

Two flows:

- **Rotating an existing variable** (changing its value) → just edit `.envrc` and apply (Section 1 below).
- **Adding a brand-new variable** that doesn't exist yet → also requires HCL changes to declare the variable (Section 2 below).

If you're adding the variable from inside Claude, the `cl-adding-environment-variable` skill handles all the code edits automatically and points you at this doc for the apply step.

---

## 1. Rotating an existing variable

> **Which file?** Provider auth (Render API key, Vercel API token, Vercel team ID) lives in `envs/shared/.envrc`. Env-specific values (Clerk, Resend, S3, Rollbar, frontend domain, GitHub PAT, `TF_VAR_render_api_key` mirror) live in `envs/<env>/.envrc`.

1. **Edit the right `.envrc`** for the value you're changing:

   ```bash
   # Provider auth or Vercel team ID:
   $EDITOR /path/to/project/infra/terraform/envs/shared/.envrc

   # Anything env-specific:
   $EDITOR /path/to/project/infra/terraform/envs/<staging|production>/.envrc
   ```

2. **Re-source both files** in the env root:

   ```bash
   cd /path/to/project/infra/terraform/envs/<staging|production>
   source ../shared/.envrc
   source .envrc
   ```

3. **Apply** from the env root:

   ```bash
   terraform apply
   ```

   The plan will show one of:

   - **Server-side var** (Resend, S3, Rollbar server, etc.) → `module.render.render_env_group.main` updates, `module.render.terraform_data.web_redeploy_on_env_change` is replaced. Render's deploy API is hit; the new deploy comes up with the new value.
   - **Client-side var** (Rollbar client token, sourcemap token, etc.) → the relevant `module.vercel.vercel_project_environment_variable.main["..."]` updates, `module.vercel.terraform_data.vercel_initial_deploy` is replaced. Vercel's deploy hook is hit; Vercel redeploys with the new value.
   - **Shared var** (Clerk keys — used by both apps) → both of the above happen in one apply. Render and Vercel each redeploy. When rotating provider auth in `shared/.envrc`, also re-apply each env so any GitHub Environment secrets that mirror it (e.g. `TF_VAR_render_api_key`) pick up the new value.

   No manual redeploy needed in any case.

---

## 2. Adding a new variable

> **Shortcut.** The `cl-adding-environment-variable` Claude skill makes all the edits below in one shot — invoke it and hand off the `terraform apply` to yourself at the end. The manual steps below are the fallback when you'd rather do it by hand.

If the variable doesn't exist in the module yet, you need to declare it before you can set a value. Five files, all in `infra/terraform/`.

> **Server-side or client-side?** Server vars (read in `apps/server/src/utils/env.ts`) go in the **render** module. Client vars (read in `apps/web/src/utils/env.ts`, prefixed `NEXT_PUBLIC_`) go in the **vercel** module. Vars used by both apps (e.g. Clerk keys) go in **both**.

### Step 1 — Declare the variable in the module

**Render module** (`infra/terraform/modules/render/variables.tf`):

```hcl
variable "my_new_var" {
  type      = string
  sensitive = true   # set to false for non-secret config like log levels
}
```

Then add it to the env_group's `env_vars` map in `infra/terraform/modules/render/project.tf`:

```hcl
env_vars = {
  # ...existing entries
  MY_NEW_VAR = {
    value = var.my_new_var
  }
}
```

**Vercel module** (`infra/terraform/modules/vercel/variables.tf`):

```hcl
variable "my_new_var" {
  type      = string
  sensitive = true
}
```

Then add it to `local.app_env_vars` in `infra/terraform/modules/vercel/env_vars.tf`:

```hcl
app_env_vars = {
  # ...existing entries
  NEXT_PUBLIC_MY_NEW_VAR = {
    value     = var.my_new_var
    sensitive = true
  }
}
```

### Step 2 — Re-declare in the canonical per-env `variables.tf`

Edit `infra/terraform/envs/staging/variables.tf` only — `envs/production/variables.tf` is a symlink to it, so a single edit covers both env roots (and any future env created via [`ADD_NEW_ENV.md`](ADD_NEW_ENV.md)):

```hcl
variable "my_new_var" {
  type      = string
  sensitive = true
}
```

The env-root re-declarations are pass-throughs — no validation blocks (the module validates).

### Step 3 — Pass through in each env root's `main.tf`

```hcl
module "render" {
  # ...existing args
  my_new_var = var.my_new_var
}

module "vercel" {
  # ...existing args (only if it's a client/shared var)
  my_new_var = var.my_new_var
}
```

### Step 4 — Add to `.envrc.example` and populate `.envrc`

In `infra/terraform/envs/<env>/.envrc.example`:

```bash
export TF_VAR_my_new_var=""
```

Then in your local `.envrc` (gitignored), set the real value:

```bash
export TF_VAR_my_new_var="actual-value"
```

### Step 5 — Source and apply

```bash
cd /path/to/project/infra/terraform/envs/<staging|production>
source ../shared/.envrc   # provider auth + Vercel team ID
source .envrc             # env-specific values (including the new one)
terraform apply
```

The plan should show the new resource being added to `render_env_group.main` (and/or `vercel_project_environment_variable.main`), plus the corresponding redeploy trigger being replaced. Each redeploy trigger calls `scripts/verify-deploy.ts`, which triggers the platform's deploy and polls its status API until the new build is live. Expect a 3–5 minute pause on each platform's step before Terraform exits.

> **Code-level changes.** If the new variable is also read at runtime by the app (most are), don't forget to add it to `apps/server/src/utils/env.ts` (or `apps/web/src/utils/env.ts`) and to the matching `.env.example` so local dev still works. The `cl-adding-environment-variable` skill handles those code edits.
