# Setting Up Clerk

This document covers how to set up Clerk for authentication across local and deployed environments.

> **Required** — Clerk handles all authentication; the app will not run without it.

---

## Step 1 — Decide on app structure

Each Clerk **application** ships with two instances:

- **Development instance** — issues test keys (`pk_test_...` / `sk_test_...`). Used for any non-production environment.
- **Production instance** — issues live keys (`pk_live_...` / `sk_live_...`). Requires a verified domain.

Pick one of the two structures below. The rest of this doc assumes the shared option; for per-env, repeat the steps for each app.

| Option | Apps to create | Trade-off |
|---|---|---|
| **Shared (recommended)** | One Clerk app total | Dev instance keys cover local + staging; production instance keys cover prod. Non-prod envs share users and config. |
| **Per environment** | One Clerk app per deployed env (e.g. `genesis-staging`, `genesis-prod`) | Full isolation between envs. More to manage — only worth it once QA traffic grows. |

---

## Step 2 — Create the Clerk application

1. Go to [clerk.com](https://clerk.com) and sign up
2. Click **Create application** and give it a name (e.g. your project name)
3. Open the app → **API Keys**
4. Copy the **Publishable Key** (`pk_test_...`) and **Secret Key** (`sk_test_...`)

These dev-instance test keys are used in local `.env` files and in every non-production deployed environment.

---

## Step 3 — Enable the production instance

When deploying to production for the first time:

1. Open the same Clerk app → switch to the **Production** instance (top-left dropdown)
2. Follow Clerk's domain verification flow — this mints the `pk_live_...` / `sk_live_...` keys
3. Copy the live keys

> **Important:** Live keys are only used in the production environment — never mix them with non-prod envs.

Keep these keys handy — you'll paste them into `.env` files, Render env var groups, and Vercel when following the environment setup docs (local / staging / prod / adding a new env).
