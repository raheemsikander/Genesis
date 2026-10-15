---
name: cl-adding-environment-variable
description: Use when adding, renaming, or removing an environment variable in apps/server/ or apps/web/ — secret keys, API URLs, service credentials, feature flags, or any config read from process.env. Trigger when touching apps/server/src/utils/env.ts, apps/web/src/utils/env.ts, .env.example files, or when the user says things like "add an env var", "I need a new secret", "set up the X API key", "add NEXT_PUBLIC_*", or "configure RESEND_API_KEY". You must invoke this skill before adding any env var — t3-env validation, .env.example sync, Terraform module wiring, and CLAUDE.md docs all need updating in lockstep, and missing one breaks startup or deploys.
---

# Adding an Environment Variable

## Overview

Environment variables are validated at startup via `@t3-oss/env-core` (server) or `@t3-oss/env-nextjs` (web) with Zod schemas. All access goes through a typed `env` object — never use `process.env` directly in application code.

`references/env-vars.md` is the canonical inventory of every variable in the monorepo (server, web, mobile). Read it to see what already exists, and update it whenever a variable is added, renamed, or removed.

This skill makes all the **code-level** changes (env.ts schemas, `.env.example` files, the `references/env-vars.md` inventory, and Terraform module wiring). Once the code changes are in, point the user at [`docs/setup/UPDATE_ENV_VARS.md`](../../../docs/setup/UPDATE_ENV_VARS.md): they populate `.envrc` and run `terraform apply` themselves to roll the variable to staging/production.

### Which `.envrc` does the variable belong in?

Decide **before** following the file tables below:

- **Per-env `.envrc`** (`envs/staging/.envrc.example`, `envs/production/.envrc.example`) — the value differs between envs. Almost all app-level vars: Clerk keys (test vs live), Resend, S3, Rollbar, frontend domain. **This is the common case.**
- **Shared `.envrc`** (`envs/shared/.envrc.example`) — the value is identical across every env. Provider auth (Render API key, Vercel API token, GitHub PAT), Vercel team ID, repo URL. New variables rarely belong here unless they're a new provider's auth.

The file tables in this skill assume per-env. If the variable is shared, replace the per-env `.envrc.example` rows with a single `infra/terraform/envs/shared/.envrc.example` row, and skip the per-env tfvars/variables.tf wiring (shared takes the value through its own `variables.tf`).

> **Apply to every env that exists, not just the ones named below.** The tables list `staging` and `production` because those are the current env roots, but the rule is: repeat each per-env row for **every** directory that exists under `infra/terraform/envs/` (except `shared/`, which has its own row). Before editing, run `ls infra/terraform/envs/` and treat every result as an env to update. If a new env (e.g. `preview/`, `eu/`) has been added since this skill was written, it still needs the same wiring — don't skip it just because it's not named here. The same principle applies to any new `.env*` files under `apps/*/`: if one exists, the variable belongs in it.

---

## Backend (apps/server)

### Files to edit

| File | What to do |
|------|------------|
| `apps/server/src/utils/env.ts` | Add Zod schema entry to `server` object |
| `apps/server/.env.example` | Add example value for local dev |
| `infra/terraform/modules/render/variables.tf` | Add a `variable` block (set `sensitive = true` for secrets) |
| `infra/terraform/modules/render/project.tf` | Add the var to `render_env_group.main`'s `env_vars = { ... }` map |
| `infra/terraform/envs/staging/variables.tf` | Re-declare the variable (pass-through; no validation). **Canonical file — `envs/production/variables.tf` is a symlink to this one, so editing staging covers production automatically.** |
| `infra/terraform/envs/staging/main.tf` | Pass `var.<name>` into `module "render"` |
| `infra/terraform/envs/production/main.tf` | Same |
| `infra/terraform/envs/staging/.envrc.example` | Add `export TF_VAR_<name>=""` |
| `infra/terraform/envs/production/.envrc.example` | Same |
| `references/env-vars.md` | Add the var to the **Server** list (required or optional section) |
| `docs/setup/LOCAL_ENV.md` | If the var needs a non-trivial local value (signup flow, API key generation), add a row to the Step 4 server table with "How to get it" |
| `apps/server/.env` | **DO NOT read or write this file.** Ask the user to set the value manually |

### How to add the schema

In `apps/server/src/utils/env.ts`, add to the `server` object:

```typescript
export const env = createEnv({
  server: {
    // ...existing vars
    STRIPE_SECRET_KEY: z.string().min(1),           // required
    FEATURE_FLAG_X: z.boolean().default(false),     // optional with default
    WEBHOOK_URL: z.url().optional(),                // truly optional
  },
  runtimeEnv: process.env,
});
```

Then use it anywhere on the server:

```typescript
import { env } from "../utils/env";
const key = env.STRIPE_SECRET_KEY;
```

### Pattern: Optional service variable

For optional integrations (like Resend), guard at the usage site:

```typescript
export function getStripeClient(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe not configured. Set STRIPE_SECRET_KEY to enable.");
  }
  return new Stripe(env.STRIPE_SECRET_KEY);
}
```

---

## Frontend (apps/web)

### Files to edit

| File | What to do |
|------|------------|
| `apps/web/src/utils/env.ts` | Add Zod schema entry to `client` object **AND** `runtimeEnv` mapping |
| `apps/web/.env.example` | Add example value for local dev |
| `infra/terraform/modules/vercel/variables.tf` | Add a `variable` block |
| `infra/terraform/modules/vercel/env_vars.tf` | Add the var to `local.app_env_vars` |
| `infra/terraform/envs/staging/variables.tf` | Re-declare (pass-through). **Canonical file — `envs/production/variables.tf` is a symlink to this one, so editing staging covers production automatically.** |
| `infra/terraform/envs/staging/main.tf` | Pass `var.<name>` into `module "vercel"` |
| `infra/terraform/envs/production/main.tf` | Same |
| `infra/terraform/envs/staging/.envrc.example` | Add `export TF_VAR_<name>=""` |
| `infra/terraform/envs/production/.envrc.example` | Same |
| `references/env-vars.md` | Add the var to the **Web** list |
| `docs/setup/LOCAL_ENV.md` | If non-trivial to obtain locally, add a row to the Step 4 web table |
| `apps/web/.env` | **DO NOT read or write this file.** Ask the user to set the value manually |

### How to add the schema

**All frontend env vars MUST be prefixed with `NEXT_PUBLIC_`.**

In `apps/web/src/utils/env.ts`:

```typescript
export const env = createEnv({
  client: {
    // ...existing vars
    NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
  },
  runtimeEnv: {
    // ...existing mappings
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  },
});
```

**Both** the `client` schema AND the `runtimeEnv` mapping are required — missing either causes a build error.

---

## Shared (used by both apps)

If the same variable is read by both server and web (e.g. Clerk keys), wire it through **both** the render module and the vercel module — duplicate the rows from both tables above.

---

## After the code changes — hand off to the user

Once all edits are done, tell the user:

> Code is wired up. To roll this variable to staging/production:
>
> 1. Open `infra/terraform/envs/staging/.envrc` (gitignored — create from `.envrc.example` if it doesn't exist) and set `TF_VAR_<name>="<actual-value>"`.
> 2. Same for `infra/terraform/envs/production/.envrc` if production is live.
> 3. From the env root: `source ../shared/.envrc && source .envrc && terraform apply`.
>
> Full reference: [`docs/setup/UPDATE_ENV_VARS.md`](docs/setup/UPDATE_ENV_VARS.md) (Section 2).

Don't run `terraform apply` yourself — the user owns the cloud-side rollout.

---

## GitHub Environment Secrets (CI-only vars)

If the variable is used **only** by GitHub Actions workflows (deploy hooks, workflow-side database URLs) and not by the app at runtime, it belongs in a GitHub Environment secret managed by `infra/terraform/modules/github/`. Add it to:

- `infra/terraform/modules/github/variables.tf`
- `infra/terraform/modules/github/main.tf` (as a `github_actions_environment_secret` resource)
- `envs/staging/variables.tf` (production's variables.tf symlinks here, so one edit covers both) and both env roots' `main.tf`
- Both `.envrc.example` files

Then the user runs `terraform apply` to populate the secret in the GitHub Environment. There is no `env.ts` schema entry for these — they don't reach the app.

---

## Validation timing

- **Server**: Validated at runtime on app startup (via `dotenv/config` import)
- **Web**: Validated at build time (env.ts is imported in `next.config.ts`)
- **Both**: Skipped when `CI=true` (allows CI builds without env files)

## Quick reference

| Need | Zod Schema | Required? |
|------|-----------|-----------|
| API key | `z.string().min(1)` | Yes |
| Optional API key | `z.string().min(1).optional()` | No |
| URL | `z.url()` | Yes |
| Email | `z.email()` | Yes |
| Enum | `z.enum(["a", "b", "c"])` | Yes |
| Enum with default | `z.enum(["a", "b"]).default("a")` | No (has default) |
| Boolean flag | `z.boolean().default(false)` | No (has default) |

## What you DON'T need to do

- **No `process.env` access** — always use the typed `env` object
- **No manual dotenv setup** — server loads `dotenv/config` automatically, Next.js handles web
- **No runtime type casting** — Zod handles parsing and validation
- **No clicking around in Render or Vercel dashboards** — Terraform owns deployed env vars now

## IMPORTANT: .env files are off-limits

**NEVER read or write `.env` files.** These files contain secrets and credentials. After adding the env schema and `.env.example` entry, ask the user to manually set the value in their `.env` file. Example prompt:

> "Please add `STRIPE_SECRET_KEY=<your-key>` to `apps/server/.env`."

The same rule applies to `infra/terraform/envs/<env>/.envrc` — these are gitignored and hold real secrets. Edit `.envrc.example` only; ask the user to copy/populate `.envrc` themselves.

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Frontend var missing `NEXT_PUBLIC_` prefix | Next.js won't expose it to the browser. Add the prefix |
| Added to `client` but not `runtimeEnv` | Build error. Must add to both objects in web env.ts |
| Using `process.env.X` directly | Bypasses validation and type safety. Import from `env.ts` |
| Forgot `.env.example` | Other developers won't know the var exists |
| Added to module but not env-root `variables.tf` | `terraform plan` errors with "module call has no argument" |
| Forgot to pass through in env-root `main.tf` | Module receives the variable's default (usually empty string) |
| Edited `.envrc` directly | Use `.envrc.example` and tell the user to copy. `.envrc` is gitignored real secrets |
