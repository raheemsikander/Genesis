# Setting Up Local Development

This document covers everything a new developer needs to run the project locally.

---

## Prerequisites

Before you start, make sure you have the following installed:

- **Node.js** >= 24
- **pnpm** — check the exact version in the `packageManager` field of `package.json`, then run `npm install -g pnpm@<version>`
- **Docker Desktop** — download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)

---

## Install dependencies

```bash
pnpm install
```

---

## Rename the project (new product from the template)

If you're contributing to the Genesis platform itself, skip this step. If you started a new product from the template (see [Step 0 in the README](../../README.md#step-0--start-a-new-product-from-this-template)), rename the `genesis` placeholders to your project name before doing anything else.

```bash
pnpm rename <your-project-name>
```

Rules for the name:
- Lowercase letters and digits only, no hyphens or underscores — e.g. `acme`, `bluejay`, `portal`.
- 3–20 characters, starts with a letter.

The script auto-detects your GitHub repo URL from `git remote get-url origin` and prompts you to confirm.

**What it doesn't cover:**
- **`CLAUDE.md` and root `README.md`** — these talk about Genesis as the platform itself. Edit them by hand if you want the docs to read as your product's docs.
- **Runtime brand strings** — web app title, email templates, e2e assertions ship as your product's display name. Update these as you settle on your own branding.

The script is a one-shot — running it again after the repo is renamed exits as a no-op.

---

## Step 1 — Configure the GitHub repository

Apply the standard merge settings, branch protection rulesets, security features, and Dependabot alerts.

**Prerequisites:**
- The [`gh` CLI](https://cli.github.com/) installed and authenticated. Run `gh auth login` first if you haven't, and confirm with `gh auth status`. (If you already have `GITHUB_TOKEN` exported in your shell, `gh` uses that automatically — no need to re-login.)
- Admin access on the target repo.

```bash
pnpm configure-repo
```

The script prints its plan and asks for confirmation before making changes, and is idempotent — re-run it any time settings drift. Pass `--yes` to skip the prompt (e.g., in scripts or re-runs).

---

## Step 2 — Set up third-party integrations

Only **Clerk** is required to start the app. All other integrations are optional — you can wire them up now if you already know you'll use it, or come back later when you actually need it.

See the full list in the [root README](../../README.md#step-1--set-up-third-party-integrations-first).

### Required

- **Clerk** (auth) — follow [`integrations/CLERK.md`](integrations/CLERK.md) to create the app and grab your `pk_test_...` / `sk_test_...` keys. The app will not start without these.

For each one you set up now, keep the keys/URLs handy — you'll paste them into `.env` files in Step 4. For ones you skip, leave the matching `.env` entries blank and revisit when needed.

---

## Step 3 — Bootstrap the project

The app itself runs outside Docker. Docker Compose only provides the backing services (database, cache, storage).

> **Database credentials:** The PostgreSQL username, password, and database name are defined in `docker-compose.yml`. Use these to connect with external tools like DBeaver.

> **Why port 5433?** Postgres's default port (5432) is often already taken by a system-installed Postgres, so we map the container to **5433** by default. The ephemeral test stack uses **5434** for the same reason (`docker-compose.test.yml`), plus **6380** for Redis and **9002**/**9003** for MinIO. Every one of these is the slot-0 default and is env-substituted from the sandbox slot, so if they collide on your machine, take a different slot rather than hand-editing the compose files. See [`parallel-sandboxes.md`](../engineering/parallel-sandboxes.md).

Open **Docker Desktop** first and wait for it to fully start (the whale icon in your menu bar should stop animating). Then from the project root:

```bash
pnpm run setup
```

This single command does the first-run bootstrap:

1. Copies `apps/server/.env.example` → `apps/server/.env` and `apps/web/.env.example` → `apps/web/.env` (skipped if they already exist)
2. Starts the local infrastructure containers (Postgres, Redis, MinIO) and waits for them to be healthy
3. Creates the `file-uploads` MinIO bucket by running the `minio-init` one-shot container (gated behind the `init` compose profile, so a bare `pnpm infra:up` does not run it; `pnpm run setup` invokes it explicitly for this checkout's sandbox slot, and `zx scripts/sandbox.ts infra bucket-init` re-runs just that step)
4. Runs all pending database migrations

`pnpm run setup` is idempotent and safe to re-run, with one caveat: it never overwrites existing `.env` files, and if their ports no longer match the worktree's sandbox slot the env preflight stops it (fix the named ports in place, or delete both `.env` files and re-run). Day-to-day after the first run, you only need `pnpm infra:up` (to start the docker services) and `pnpm dev` (to start the app).

| Service | URL | Purpose |
|---------|-----|---------|
| PostgreSQL 16 | `localhost:5433` | Main database |
| Redis 7 | `localhost:6379` | Background job queue |
| MinIO | `localhost:9000` (console at `:9001`) | Local S3-compatible file storage; `file-uploads` bucket created during `pnpm run setup` |

---

## Step 4 — Fill in Clerk keys

`pnpm run setup` created `.env` files from the templates, but Clerk credentials still need to be pasted in by hand. Open each `.env` file and fill in the required values:

### Server (`apps/server/.env`)

| Variable | How to get it |
|----------|--------------|
| `CLERK_PUBLISHABLE_KEY` | [Clerk Dashboard](https://dashboard.clerk.com) → your app → **API Keys** |
| `CLERK_SECRET_KEY` | [Clerk Dashboard](https://dashboard.clerk.com) → your app → **API Keys** |
| `DATABASE_URL` | Pre-filled to match `docker-compose.yml` — no changes needed |
| `REDIS_URL` | Pre-filled to `redis://localhost:6379` — no changes needed |
| `S3_*` vars | Pre-filled to match the local MinIO container — no changes needed |
| `S3_PUBLIC_ENDPOINT` | Optional. When testing file uploads/downloads from a **physical device** (phone, tablet), set this to your machine's LAN IP MinIO URL (e.g. `http://192.168.1.10:9000`). Presigned GET URLs are signed against this host; leave blank on desktop-only dev. |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | [Resend Dashboard](https://resend.com) → **API Keys** (optional — leave blank to disable email) |

### Web (`apps/web/.env`)

| Variable | How to get it |
|----------|--------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Same publishable key from [Clerk Dashboard](https://dashboard.clerk.com) |
| `CLERK_SECRET_KEY` | Same secret key from [Clerk Dashboard](https://dashboard.clerk.com) |

All other values are pre-filled and correct for local development.

---

## Step 5 — Start the app

```bash
pnpm dev
```

This starts three processes in one terminal:

| Process | URL | What it does |
|---------|-----|-------------|
| Web | http://localhost:3001 | Next.js frontend |
| Server | http://localhost:3000 | Express API |
| Worker | — | BullMQ worker (background + scheduled jobs). Connects to Redis from `pnpm infra:up`. |

Health check: http://localhost:3000/health (liveness — process is up; this is what Render pings). For a deep check that pings Postgres, Redis, and S3 with per-service status and latency, use http://localhost:3000/health/detailed (returns 503 if any check fails). The detailed endpoint is intentionally not Render's probe so a downstream outage doesn't restart-loop the API.

> The worker processes background and scheduled jobs. It runs automatically with `pnpm dev`. If you need it in a separate terminal: `pnpm --filter server dev:worker`

> **In a git worktree?** Every checkout runs in its own sandbox slot with its own ports, so the URLs above are the slot-0 defaults. Run `pnpm sandbox` to see yours. Always start the app with `pnpm dev`: it exports the slot's ports for you. Starting `pnpm dev:web` / `pnpm dev:server` directly binds the slot-0 ports unless you set `WEB_PORT` / `PORT` yourself. See [parallel sandboxes](../engineering/parallel-sandboxes.md).

---

## Step 6 — Verify the app works

With `pnpm dev` running, do a quick smoke test:

1. Open **http://localhost:3001** in your browser
2. You should see the landing page or be redirected to `/sign-in`
3. Sign up with a new account via Clerk
4. After sign-up, you should land on `/portal` — the authenticated dashboard
5. Check the terminal running `pnpm dev` — you should see server logs showing the user sync

If the browser shows an error or blank page, check the terminal output from `pnpm dev` for errors. The most common cause is missing or invalid Clerk keys in your `.env` files.

---

## Run the mobile app (Expo) — optional

The repo also ships an Expo (React Native) app at `apps/mobile/`. It's optional — skip this section if you only need the web app. The mobile app reuses the same shared data/auth layer (`@repo/shared`, `@repo/orpc-contracts`, the oRPC client, Clerk), so it talks to the **same Express server** as the web app.

**Prerequisites (in addition to the ones at the top):**

- An iOS Simulator (via Xcode, macOS only) and/or an Android emulator (via Android Studio), **or** a physical device with the [Expo Go](https://expo.dev/go) app installed.

**1. Create the mobile `.env`.** Unlike the server and web `.env` files, `pnpm run setup` does **not** create this one — copy it by hand:

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Then fill in the two required values (validated at startup via `apps/mobile/src/utils/env.ts`):

| Variable | How to get it |
|----------|--------------|
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | The **same** `pk_test_...` publishable key the web app uses ([Clerk Dashboard](https://dashboard.clerk.com) → API Keys) |
| `EXPO_PUBLIC_SERVER_URL` | `http://localhost:3000` works in the **iOS Simulator**. On a **physical device** (Expo Go) use your machine's LAN IP — e.g. `http://192.168.1.5:3000` — because `localhost` resolves to the phone itself, not your computer. On the **Android emulator**, `localhost` resolves to the emulator itself, not the host machine. Use `http://10.0.2.2:3000` (the emulator's alias for the host loopback), or run `adb reverse tcp:3000 tcp:3000` once per emulator boot to forward the port so `localhost` works. |

**2. Start the backend.** The mobile app has no mock layer — sign-in and any data fetching hit the real server. In one terminal:

```bash
pnpm infra:up        # if not already running
pnpm dev:server      # Express API on :3000
```

(You can also run the full `pnpm dev`; the mobile app only needs the server + infra.)

**3. Start the Expo dev server.** In another terminal:

```bash
pnpm dev:mobile      # = turbo -F mobile start → expo start
```

From the Expo output: press **`i`** for the iOS Simulator, **`a`** for the Android emulator, or scan the QR code with **Expo Go** on a physical device (this is the case that needs the LAN IP above).

> **Note:** See [`apps/mobile/README.md`](../../apps/mobile/README.md) for the same run steps in app-local form, and [`apps/mobile/CLAUDE.md`](../../apps/mobile/CLAUDE.md) for the mobile conventions (Uniwind, native UI, version pins). Always use the pnpm/turbo commands, never `npm install` / `npx expo start`.

The mobile app is **local-only** today — it has no Render/Vercel/Terraform deploy pipeline (those docs cover the server + web only). Shipping it would go through EAS / the app stores, which isn't wired up yet.

---

## Next steps

- **Running tests:** The test suite needs additional setup beyond `pnpm install` — a separate test database and (for E2E) Playwright browsers. See [Running tests locally](integrations/RUNNING_TESTS.md) before opening your first PR.
- **Apollo plugin (optional):** If you use Claude Code, see [Setting up the Apollo plugin](integrations/APOLLO.md) to install `apollo` for feature/fix/PR workflows.
- **BullMQ dashboard:** http://localhost:3000/admin/jobs — inspect queues, jobs, and failures. Requires you to be signed in as a user with `role: admin` (set via Clerk's `unsafeMetadata`); members get a 403. The dashboard is only mounted when `NODE_ENV=development`; it is off in `test`, `staging`, and `production`. Exposing it in any deployed environment requires loosening the gate in `apps/server/src/index.ts` after ops sign-off.

---

## Stopping everything

```bash
pnpm infra:down              # Stop containers (data is preserved)
pnpm infra:down --volumes    # Stop containers AND delete all data
```
