# Setting Up Local Development

This document covers everything a new developer needs to run the project locally.

---

## Prerequisites

Before you start, make sure you have the following installed:

- **Node.js** >= 24
- **pnpm** >= 10 — check the exact version in the `packageManager` field of `package.json`, then run `npm install -g pnpm@<version>`
- **Docker Desktop** — download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)

---

## Step 1 — Create your repo from the template, then clone and install

Genesis is a GitHub template repository. Create your own repo from it first, then clone that new repo locally.

### Create the repo (GitHub UI)

1. Open the Genesis template repo on GitHub
2. Click **Use this template → Create a new repository**
3. Pick the owner (org or your account), name the repo, and set visibility
4. Check **Include all branches** — this copies over both `develop` and `main`. `develop` is where active development flows; `main` is used for production releases.
5. Click **Create repository**

### Clone and install

Clone the new repo however you prefer (HTTPS, SSH, `gh repo clone`, or your Git GUI). A typical CLI flow:

```bash
git clone <your-new-repo-url>
cd <your-new-repo-name>
pnpm install
```

---

## Step 2 — Configure the GitHub repository

Apply the standard merge settings, branch protection rulesets, security features, and Dependabot alerts:

```bash
pnpm configure-repo
```

Requirements: the [`gh` CLI](https://cli.github.com/) installed and authenticated (`gh auth login`), and admin access on the target repo. The script prints its plan and asks for confirmation before making changes, and is idempotent — re-run it any time settings drift. Pass `--yes` to skip the prompt (e.g., in scripts or re-runs).

---

## Step 3 — Set up third-party integrations

Before continuing, set up accounts for every integration you plan to use — the required ones must be done before you can start the app, and doing the optional ones now keeps you from having to revisit `.env` files later. See the full list in the [root README](../../README.md#step-1--set-up-third-party-integrations-first).

### Required

- **Clerk** (auth) — follow [`integrations/CLERK.md`](integrations/CLERK.md) to create the app and grab your `pk_test_...` / `sk_test_...` keys. The app will not start without these.

### Optional (recommended if you know you'll use them)

- **Rollbar** (error tracking) — [`integrations/ROLLBAR.md`](integrations/ROLLBAR.md)
- **Resend** (transactional email) — sign up at [resend.com](https://resend.com) and grab an API key + verified sender address
- **Cloudflare R2** (prod file storage; MinIO covers local) — [`integrations/R2_STORAGE.md`](integrations/R2_STORAGE.md)

Keep the keys/URLs handy — you'll paste them into `.env` files in Step 5.

---

## Step 4 — Start local infrastructure

The app itself runs outside Docker. Docker Compose only provides the backing services (database, cache, storage).

> **Database credentials:** The PostgreSQL username, password, and database name are defined in `docker-compose.yml`. Use these to connect with external tools like DBeaver.

> **Port conflict:** If you already have PostgreSQL running locally on port 5432, change the port mapping in `docker-compose.yml` from `"5432:5432"` to `"5433:5432"`, then update `DATABASE_URL` in your `.env` to use port 5433.

1. Open **Docker Desktop** and wait for it to fully start (the whale icon in your menu bar should stop animating)
2. *(Optional)* If you'd like the local Postgres/MinIO credentials to match your project name instead of the default `genesis`, edit `docker-compose.yml` — update `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `MINIO_ROOT_USER`, and `MINIO_ROOT_PASSWORD` to whatever you prefer. Purely cosmetic — just keep `DATABASE_URL` and the MinIO login in your `.env` (Step 5) in sync with whatever you choose.
3. From the project root, run:

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

## Step 6 — Create the MinIO bucket

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

## Step 7 — Run database migrations

```bash
pnpm db:migrate
```

This creates all the database tables. You should see each migration applied in sequence.

> If you hit an error about tables already existing (e.g. from a previous `pnpm db:push`), you may need to reset the database. This will **delete all local data** — check with your team before proceeding.

---

## Step 8 — Start the app

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

## Step 9 — Verify the app works

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
