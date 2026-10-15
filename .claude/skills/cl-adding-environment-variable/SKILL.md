---
name: cl-adding-environment-variable
description: Use when adding, renaming, or removing an environment variable in apps/server/ or apps/web/ — secret keys, API URLs, service credentials, feature flags, or any config read from process.env. Trigger when touching apps/server/src/utils/env.ts, apps/web/src/utils/env.ts, .env.example files, or when the user says things like "add an env var", "I need a new secret", "set up the X API key", "add NEXT_PUBLIC_*", or "configure RESEND_API_KEY". You must invoke this skill before adding any env var — t3-env validation, .env.example sync, and CLAUDE.md docs all need updating in lockstep, and missing one breaks startup.
---

# Adding an Environment Variable

## Overview

Environment variables are validated at startup via `@t3-oss/env-core` (server) or `@t3-oss/env-nextjs` (web) with Zod schemas. All access goes through a typed `env` object — never use `process.env` directly in application code.

## Backend (apps/server)

### Files to Touch

| File | What to do |
|------|------------|
| `apps/server/src/utils/env.ts` | Add Zod schema to `server` object |
| `apps/server/.env.example` | Add example value |
| `render.yaml` | Add the var to every `envVarGroups` entry (secrets) or service `envVars` (non-secret config) |
| `CLAUDE.md` | Add the var to the **Environment Variables → Server** list (required or optional section) |
| `docs/setup/ENV_VARS.md` | Add a row to the **Render — Server Environment Group** table so deployed envs know to set it |
| `docs/setup/LOCAL_ENV.md` | If the var needs a non-trivial local value (API key, signup, etc.), add a row to the Step 4 server table with "How to get it" |
| `apps/server/.env` | **DO NOT read or write this file.** Ask the user to set the value manually |

### How to Add

In `apps/server/src/utils/env.ts`, add to the `server` object:

```typescript
export const env = createEnv({
  server: {
    // ...existing vars
    STRIPE_SECRET_KEY: z.string().min(1),           // required
    FEATURE_FLAG_X: z.boolean().default(false),      // optional with default
    WEBHOOK_URL: z.url().optional(),                 // truly optional
  },
  runtimeEnv: process.env,
});
```

Then use it anywhere on the server:

```typescript
import { env } from "../utils/env";
const key = env.STRIPE_SECRET_KEY;
```

### Add to `render.yaml`

Also add the variable to `render.yaml` so deployed environments have it.

**Secrets (API keys, credentials)** — Add to `envVarGroups` with `sync: false`:

```yaml
envVarGroups:
  - name: staging-secrets
    envVars:
      # ...existing vars
      - key: STRIPE_SECRET_KEY
        sync: false
```

Add it to **all** `envVarGroups` that exist in `render.yaml` (e.g. `staging-secrets`, `production-secrets`, and any other environment groups).

**Non-secret config (feature flags, log levels)** — Set the value directly in the service's `envVars`:

```yaml
services:
  - type: web
    envVars:
      - key: LOG_LEVEL
        value: info
```

**Worker service** — If the variable is needed by background jobs (BullMQ worker), add it to the worker service's `envVars` too — or use a shared `envVarGroup` so both the API and worker get it.

### Pattern: Optional Service Variable

For optional integrations (like Resend), guard at the usage site:

```typescript
export function getStripeClient(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe not configured. Set STRIPE_SECRET_KEY to enable.");
  }
  return new Stripe(env.STRIPE_SECRET_KEY);
}
```

### Manual step — Render dashboard

After all file edits are done, ask the user to set the actual value in Render: service → **Environment** → find the env var group → add the value → trigger a redeploy so it's picked up.

## Frontend (apps/web)

### Files to Touch

| File | What to do |
|------|------------|
| `apps/web/src/utils/env.ts` | Add Zod schema to `client` object AND `runtimeEnv` mapping |
| `apps/web/.env.example` | Add example value |
| `CLAUDE.md` | Add the var to the **Environment Variables → Web** list (required or optional section) |
| `docs/setup/ENV_VARS.md` | Add a row to the **Vercel — Web Environment Variables** table so deployed envs know to set it |
| `docs/setup/LOCAL_ENV.md` | If the var needs a non-trivial local value (API key, signup, etc.), add a row to the Step 4 web table with "How to get it" |
| `apps/web/.env` | **DO NOT read or write this file.** Ask the user to set the value manually |

### How to Add

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

Then use it:

```typescript
import { env } from "../utils/env";
const key = env.NEXT_PUBLIC_POSTHOG_KEY;
```

### Deployment (Vercel)

Frontend env vars are managed in the Vercel dashboard — there is no config file. Ask the user to:

1. Go to **Project → Settings → Environment Variables**
2. Add the variable (e.g. `NEXT_PUBLIC_POSTHOG_KEY`)
3. Select which environments it applies to (Production, Staging, etc.)
4. Set the value
5. Redeploy for the change to take effect

## GitHub Environment Secrets (CI-only vars)

If the variable is used **only** by GitHub Actions workflows (deploy hooks, workflow-side database URLs, etc.) and not by the app at runtime, it belongs in a **GitHub Environment secret** — not in `render.yaml`, Vercel, or `env.ts`.

Ask the user to add it manually: repo → **Settings → Environments → `<env-name>` → Add secret**. Update `docs/setup/ENV_VARS.md` to add a row describing the new secret.

### Validation Timing

- **Server**: Validated at runtime on app startup (via `dotenv/config` import)
- **Web**: Validated at build time (env.ts is imported in `next.config.ts`)
- **Both**: Skipped when `CI=true` (allows CI builds without env files)

## Quick Reference

| Need | Zod Schema | Required? |
|------|-----------|-----------|
| API key | `z.string().min(1)` | Yes |
| Optional API key | `z.string().min(1).optional()` | No |
| URL | `z.url()` | Yes |
| Email | `z.email()` | Yes |
| Enum | `z.enum(["a", "b", "c"])` | Yes |
| Enum with default | `z.enum(["a", "b"]).default("a")` | No (has default) |
| Boolean flag | `z.boolean().default(false)` | No (has default) |

## What You DON'T Need To Do

- **No `process.env` access** — always use the typed `env` object
- **No manual dotenv setup** — server loads `dotenv/config` automatically, Next.js handles web
- **No runtime type casting** — Zod handles parsing and validation

## IMPORTANT: .env Files Are Off-Limits

**NEVER read or write `.env` files.** These files contain secrets and credentials. After adding the env schema and `.env.example` entry, ask the user to manually set the value in their `.env` file. Example prompt:

> "Please add `STRIPE_SECRET_KEY=<your-key>` to `apps/server/.env`."

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Frontend var missing `NEXT_PUBLIC_` prefix | Next.js won't expose it to the browser. Add the prefix |
| Added to `client` but not `runtimeEnv` | Build error. Must add to both objects in web env.ts |
| Using `process.env.X` directly | Bypasses validation and type safety. Import from `env.ts` |
| Forgot `.env.example` | Other developers won't know the var exists |
