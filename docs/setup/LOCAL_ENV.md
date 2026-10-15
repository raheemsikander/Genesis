# Setting Up Local Development

This document covers everything a new developer needs to run the project locally.

---

## Prerequisites

Before you start, make sure you have the following installed:

- **Node.js** >= 24
- **pnpm** — check the exact version in the `packageManager` field of `package.json`, then run `npm install -g pnpm@<version>`
- **Docker Desktop** — download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)

---

## Rename the project (fork only)

If you just forked Genesis for a new product, rename the `genesis` placeholders to your project name before doing anything else. Requires the repo cloned and `pnpm install` already run.

```bash
pnpm rename <your-project-name>
```

Rules for the name:
- Lowercase letters and digits only, no hyphens or underscores — e.g. `acme`, `bluejay`, `portal`.
- 3–20 characters, starts with a letter.

**What it covers:** `package.json`, `docker-compose.yml`, `docker-compose.test.yml`, `render.yaml`, the `.env.example` files, the server CI workflow, and the deployment/local/staging setup docs under `docs/setup/` and `docs/engineering/`. Enough to make deployment and local dev reflect your project name.

**What it doesn't cover:** Some `genesis` references remain — mostly runtime brand strings (web app title, email templates, e2e assertions) that ship as your product's display name. Leave these for now; update them as the project progresses and you settle on your own branding. Run `grep -rn genesis .` whenever you're ready to clean them up.

The script is a one-shot — running it again after the repo is renamed exits as a no-op.

If you're contributing to the Genesis platform itself (not forking it), skip this step.

---

## Step 1 — Configure the GitHub repository

Apply the standard merge settings, branch protection rulesets, security features, and Dependabot alerts:

```bash
pnpm configure-repo
```

Requirements: the [`gh` CLI](https://cli.github.com/) installed and authenticated (`gh auth login`), and admin access on the target repo. The script prints its plan and asks for confirmation before making changes, and is idempotent — re-run it any time settings drift. Pass `--yes` to skip the prompt (e.g., in scripts or re-runs).

---

## Step 2 — Set up third-party integrations

Before continuing, set up accounts for every integration you plan to use — the required ones must be done before you can start the app, and doing the optional ones now keeps you from having to revisit `.env` files later. See the full list in the [root README](../../README.md#step-1--set-up-third-party-integrations-first).

### Required

- **Clerk** (auth) — follow [`integrations/CLERK.md`](integrations/CLERK.md) to create the app and grab your `pk_test_...` / `sk_test_...` keys. The app will not start without these.

### Optional (recommended if you know you'll use them)

- **Rollbar** (error tracking) — [`integrations/ROLLBAR.md`](integrations/ROLLBAR.md)
- **Resend** (transactional email) — sign up at [resend.com](https://resend.com) and grab an API key + verified sender address
- **Cloudflare R2** (prod file storage; MinIO covers local) — [`integrations/R2_STORAGE.md`](integrations/R2_STORAGE.md)

Keep the keys/URLs handy — you'll paste them into `.env` files in Step 4.

---

## Step 3 — Bootstrap the project

The app itself runs outside Docker. Docker Compose only provides the backing services (database, cache, storage).

> **Database credentials:** The PostgreSQL username, password, and database name are defined in `docker-compose.yml`. Use these to connect with external tools like DBeaver.

> **Why port 5433?** Postgres's default port (5432) is often already taken by a system-installed Postgres, so we map the container to **5433** by default. The integration test DB uses **5434** for the same reason (`docker-compose.test.yml`). If both 5433 and 5434 are also in use on your machine, edit the `ports:` lines in those compose files plus `DATABASE_URL` / `TEST_DATABASE_URL` in `apps/server/.env`.

Open **Docker Desktop** first and wait for it to fully start (the whale icon in your menu bar should stop animating). Then from the project root:

```bash
pnpm setup
```

This single command does the first-run bootstrap:

1. Copies `apps/server/.env.example` → `apps/server/.env` and `apps/web/.env.example` → `apps/web/.env` (skipped if they already exist)
2. Starts the local infrastructure containers (Postgres, Redis, MinIO) and waits for them to be healthy
3. Creates the `file-uploads` MinIO bucket by running the `minio-init` one-shot container (gated behind the `init` compose profile, so a bare `pnpm infra:up` does not run it; `pnpm setup` invokes it explicitly via `docker compose run --rm minio-init`)
4. Runs all pending database migrations

`pnpm setup` is idempotent — re-run it anytime. Day-to-day after the first run, you only need `pnpm infra:up` (to start the docker services) and `pnpm dev` (to start the app).

| Service | URL | Purpose |
|---------|-----|---------|
| PostgreSQL 16 | `localhost:5433` | Main database |
| Redis 7 | `localhost:6379` | Background job queue |
| MinIO | `localhost:9000` (console at `:9001`) | Local S3-compatible file storage; `file-uploads` bucket created during `pnpm setup` |

> **Port conflict:** If you already have PostgreSQL running locally on port 5432, change the port mapping in `docker-compose.yml` from `"5432:5432"` to `"5433:5432"`, then update `DATABASE_URL` in your `.env` to use port 5433.

---

## Step 4 — Fill in Clerk keys

`pnpm setup` created `.env` files from the templates, but Clerk credentials still need to be pasted in by hand. Open each `.env` file and fill in the required values:

### Server (`apps/server/.env`)

| Variable | How to get it |
|----------|--------------|
| `CLERK_PUBLISHABLE_KEY` | [Clerk Dashboard](https://dashboard.clerk.com) → your app → **API Keys** |
| `CLERK_SECRET_KEY` | [Clerk Dashboard](https://dashboard.clerk.com) → your app → **API Keys** |
| `DATABASE_URL` | Pre-filled to match `docker-compose.yml` — no changes needed |
| `REDIS_URL` | Pre-filled to `redis://localhost:6379` — no changes needed |
| `S3_*` vars | Pre-filled to match the local MinIO container — no changes needed |
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

This starts all three processes in one terminal:

| Process | URL | What it does |
|---------|-----|-------------|
| Web | http://localhost:3001 | Next.js frontend |
| Server | http://localhost:3000 | Express API |
| Worker | — | BullMQ background job processor (connects to Redis) |

Health check: http://localhost:3000/health (liveness — process is up; this is what Render pings). For a deep check that pings Postgres, Redis, and S3 with per-service status and latency, use http://localhost:3000/health/detailed (returns 503 if any check fails). The detailed endpoint is intentionally not Render's probe so a downstream outage doesn't restart-loop the API.

> The worker processes background and scheduled jobs. It runs automatically with `pnpm dev`. If you need it in a separate terminal: `pnpm --filter server dev:worker`

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

## Next steps

- **Running tests:** The test suite needs additional setup beyond `pnpm install` — a separate test database and (for E2E) Playwright browsers. See [Running tests locally](integrations/RUNNING_TESTS.md) before opening your first PR.
- **Apollo plugin (optional):** If you use Claude Code, see [Setting up the Apollo plugin](integrations/APOLLO.md) to install `apollo` for feature/fix/PR workflows.
- **BullMQ dashboard:** http://localhost:3000/admin/jobs — inspect queues, jobs, and failures. Requires you to be signed in as a user with `role: admin` (set via Clerk's `unsafeMetadata`); members get a 403. The dashboard is only mounted when `NODE_ENV=development`; it is off in `test`, `staging`, and `production`. Exposing it in any deployed environment requires loosening the gate in `apps/server/src/index.ts` after ops sign-off.

---

## Stopping everything

```bash
pnpm infra:down            # Stop containers (data is preserved)
docker compose down -v     # Stop containers AND delete all data
```
