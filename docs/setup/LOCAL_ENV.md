# Setting Up Local Development

This document covers everything a new developer needs to run the project locally.

---

## Prerequisites

Before you start, make sure you have the following installed:

- **Node.js** >= 24
- **pnpm** >= 10 — check the exact version in the `packageManager` field of `package.json`, then run `npm install -g pnpm@<version>`
- **Docker Desktop** — download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)

---

## Step 1 — Clone as template and install dependencies

Genesis is a template repository. Create your own repo from it using GitHub's "Use this template" button (or the `gh` CLI), then clone your new repo:

```bash
gh repo create <your-org>/<your-repo> --template Conrad-Labs/project-genesis-2.0 --private
git clone git@github.com:<your-org>/<your-repo>.git
cd <your-repo>
pnpm install
```

---

## Step 2 — Configure the GitHub repository

If you created this repo from the Genesis template, run the **Configure Repository** workflow to apply standard merge settings, branch protection rulesets, and Dependabot alerts in one step.

1. Go to **Actions → Configure Repository → Run workflow**
2. Fill in the two required inputs:
   - **Conrad Labs Automation GitHub App ID** — the App ID
   - **Conrad Labs Automation GitHub App private key** — the PEM private key
   > The Conrad Labs Automation GitHub App must be installed on the repo's owner (org or user account). Ask your team lead if you don't have these values.
3. Click **Run workflow** and wait for it to complete (usually under 30 seconds)

This configures:
- **Merge settings** — squash-merge only, auto-merge enabled, branch deleted after merge
- **Branch protection** — `develop` and `main` require passing CI checks and 1 approval
- **Dependabot** — vulnerability alerts enabled

> **Already configured?** If your repo was created as a fork (not a template), the `configure-fork.yml` workflow may have already applied these settings. You can skip this step — or run it anyway to ensure everything is up to date.

---

## Step 3 — Create a Clerk application

Clerk handles all authentication. You need an account before you can run the app. See [`integrations/CLERK.md`](integrations/CLERK.md) for how to create the app and grab the `pk_test_...` / `sk_test_...` keys — you'll need both in Step 4.

---

## Step 4 — Start local infrastructure

The app itself runs outside Docker. Docker Compose only provides the backing services (database, cache, storage).

> **Database credentials:** The PostgreSQL username, password, and database name are defined in `docker-compose.yml`. Use these to connect with external tools like DBeaver.

> **Port conflict:** If you already have PostgreSQL running locally on port 5432, change the port mapping in `docker-compose.yml` from `"5432:5432"` to `"5433:5432"`, then update `DATABASE_URL` in your `.env` to use port 5433.

1. Open **Docker Desktop** and wait for it to fully start (the whale icon in your menu bar should stop animating)
2. From the project root, run:

```bash
pnpm infra:up
```

This starts three services (and waits for them to be healthy):

| Service | URL | Purpose |
|---------|-----|---------|
| PostgreSQL 16 | `localhost:5432` | Main database |
| Redis 7 | `localhost:6379` | Background job queue |
| MinIO | `localhost:9000` | Local S3-compatible file storage |

Verify all three are running:

```bash
docker compose ps
```

All services should show `healthy` or `running`.

---

## Step 5 — Set up environment variables

Copy the example env files:

```bash
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
```

Then open each `.env` file and fill in the required values:

### Server (`apps/server/.env`)

| Variable | How to get it |
|----------|--------------|
| `DATABASE_URL` | Built from `docker-compose.yml` credentials. Default: `postgresql://genesis:genesis@localhost:5432/genesis` |
| `CLERK_PUBLISHABLE_KEY` | [Clerk Dashboard](https://dashboard.clerk.com) → your app → **API Keys** |
| `CLERK_SECRET_KEY` | [Clerk Dashboard](https://dashboard.clerk.com) → your app → **API Keys** |
| `RESEND_API_KEY` | [Resend Dashboard](https://resend.com) → **API Keys** (optional — leave blank to disable email) |
| `RESEND_FROM_EMAIL` | A sender address verified in Resend (optional) |
| `REDIS_URL` | Already set to `redis://localhost:6379` — matches docker-compose, no changes needed |
| `S3_*` vars | Already pre-filled to match the local MinIO container — no changes needed |

### Web (`apps/web/.env`)

| Variable | How to get it |
|----------|--------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Same publishable key from [Clerk Dashboard](https://dashboard.clerk.com) |
| `CLERK_SECRET_KEY` | Same secret key from [Clerk Dashboard](https://dashboard.clerk.com) |

All other values are pre-filled and correct for local development.

---

## Step 5 — Create the MinIO bucket

MinIO needs a bucket before you can upload files. Do this once after your first `pnpm infra:up`.

1. Open the MinIO console at **http://localhost:9001**
2. Log in with the credentials defined in `docker-compose.yml`:
   - **Username:** `genesis` (`MINIO_ROOT_USER`)
   - **Password:** `genesis123` (`MINIO_ROOT_PASSWORD`)
3. Click **Buckets** in the left sidebar
4. Click **Create Bucket**
5. Enter the name **`file-uploads`** (must match `S3_BUCKET` in your `.env`)
6. Click **Create Bucket**

> If login fails, restart the MinIO container: `docker compose restart minio`

---

## Step 6 — Run database migrations

```bash
pnpm db:migrate
```

This creates all the database tables. You should see each migration applied in sequence.

> If you hit an error about tables already existing (e.g. from a previous `pnpm db:push`), you may need to reset the database. This will **delete all local data** — check with your team before proceeding.

---

## Step 7 — Start the app

```bash
pnpm dev
```

This starts all three processes in one terminal:

| Process | URL | What it does |
|---------|-----|-------------|
| Web | http://localhost:3001 | Next.js frontend |
| Server | http://localhost:3000 | Express API |
| Worker | — | BullMQ background job processor (connects to Redis) |

Health check: http://localhost:3000/health

> The worker processes background and scheduled jobs. It runs automatically with `pnpm dev`. If you need it in a separate terminal: `pnpm --filter server dev:worker`

---

## Step 8 — Verify the app works

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

---

## Stopping everything

```bash
pnpm infra:down            # Stop containers (data is preserved)
docker compose down -v     # Stop containers AND delete all data
```
