# Phase 1: Local Setup

**Goal:** App running at `http://localhost:3001` with backend healthy at `http://localhost:3000/health`.

**Doc:** `docs/setup/LOCAL_ENV.md` — follow this doc step by step. This reference only adds verification and troubleshooting.

---

## State Check

Run these first to see what's already done. Skip any doc step that's already passing.

```bash
node --version                                                    # >= 24 (doc prerequisites)
pnpm --version                                                    # matches packageManager in package.json
docker --version                                                  # Docker installed?
docker info > /dev/null 2>&1                                      # Docker Desktop running?
gh auth status 2>&1 | head -3                                     # gh CLI authed? (doc Step 1)
pnpm sandbox                                                      # This checkout's sandbox slot, ports, and compose projects
docker compose -p "$(pnpm sandbox --json | jq -r .composeProjects.dev)" ps  # Infra services running? (doc Step 3)
ls apps/server/.env apps/web/.env 2>/dev/null                     # Env files created by `pnpm run setup`?
curl -s http://localhost:3000/health 2>/dev/null                  # Backend running? (doc Step 5)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001      # Frontend running? (doc Step 5)
```

The `localhost` ports above are the slot-0 defaults. In a git worktree, take
the real ones from `pnpm sandbox`.

---

## Verification & Troubleshooting

### Prerequisites (before any doc step)

**Verify:** `node --version` >= 24, `pnpm --version` matches the `packageManager` field in `package.json`, `docker --version` exists.

**Node.js wrong version:** Ask what version manager they use (nvm, fnm, volta, asdf, mise) and suggest the right install command — don't prescribe one.

**IMPORTANT: Node.js must be on the correct version BEFORE running `pnpm install`.** pnpm install compiles native modules against the active Node version. If the engineer switches Node after installing, they'll hit cryptic native-module errors. Block until `node --version` is >= 24.

**pnpm missing or wrong version:** `corepack enable && corepack prepare pnpm@<version> --activate` (where `<version>` is the `packageManager` field), or `npm install -g pnpm@<version>`.

**Docker missing:** Direct to Docker Desktop download — outside the skill's scope.

### After "Install dependencies" (`pnpm install`)

**Verify:**

```bash
ls node_modules/.pnpm 2>/dev/null | head -1
```

If pnpm install fails with native-module errors, double-check Node version first.

### Before "Rename the project" — fork detection

This step is **fork-only**. Ask:

> Are you building on top of Genesis as a starting point for a new product, or contributing back to the Genesis platform itself?

- **Forking for a new product:** Run `pnpm rename <your-project-name>`. Name rules: lowercase letters + digits only, no hyphens/underscores, 3–20 chars, starts with a letter.
- **Contributing to Genesis itself:** Skip.

The script is a **one-shot** — running it again after rename is a no-op. After rename, the engineer must commit the changes before `pnpm run setup`, otherwise Postgres / Render / Vercel resources will be named with the placeholder.

**Things `pnpm rename` does NOT cover** — flag these for the engineer:
- `CLAUDE.md` and root `README.md` still talk about Genesis as a platform — edit by hand if you want product docs.
- Runtime brand strings (web app title, email templates, e2e assertions) still use the Genesis display name.

### After doc Step 1 (Configure GitHub repository)

**Prereq:** `gh` CLI installed + authenticated (`gh auth status`) **and** admin access on the repo. If `GITHUB_TOKEN` is exported in their shell, `gh` picks it up automatically — no need to `gh auth login`.

**Verify:** `pnpm configure-repo` exits with code 0. The script is idempotent — safe to re-run anytime to fix drift.

**Permission denied:** Engineer doesn't have admin on the repo. They need to ask the org owner.

### After doc Step 2 (Third-party integrations)

Only **Clerk** is required to start the app. Everything else is optional and can be wired up later. If they don't have a Clerk app yet, walk them through `docs/setup/integrations/CLERK.md` before continuing — the app won't start without `pk_test_...` / `sk_test_...` keys.

### Before doc Step 3 (Bootstrap the project)

**Docker Desktop must be running, not just installed.**

```bash
docker info > /dev/null 2>&1 && echo "ok" || echo "Docker not running"
```

If "Docker not running", tell the engineer to open Docker Desktop and wait for the whale icon to stop animating.

### After doc Step 3 (`pnpm run setup`)

`pnpm run setup` is the **single first-run bootstrap**. It does four things in sequence:
1. Copies `.env.example` → `.env` for both apps (skipped if `.env` already exists)
2. Starts Postgres / Redis / MinIO via Docker Compose, waits for healthy
3. Creates the `file-uploads` MinIO bucket via the `minio-init` one-shot container (this is no longer a manual UI step)
4. Runs all pending Drizzle migrations

**Verify all four worked:**

Every checkout runs in its own sandbox slot, so the compose project name is not
always the directory name. Resolve it first, then pass it to `docker compose -p`:

```bash
COMPOSE=$(pnpm sandbox --json | jq -r .composeProjects.dev)                          # e.g. genesis-2 (slot 0) or genesis-s1
docker compose -p "$COMPOSE" ps                                                      # postgres, redis, minio all healthy
ls apps/server/.env apps/web/.env                                                    # both .env files exist
docker exec -i $(docker compose -p "$COMPOSE" ps -q postgres) sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt"' 2>/dev/null | head -20       # migration + app tables exist
```

The `\dt` output should list at least `users` and `files` plus the migration tracking table. If it shows no relations, migrations didn't apply — re-run `pnpm run setup`.

**Port 5433 in use:** `lsof -i :5433`. The dev DB publishes to host port 5433 (slot 0) to dodge a host PostgreSQL on 5432. The `ports:` mappings in `docker-compose.yml` are env-substituted from the sandbox slot, so don't hand-edit them: run `pnpm sandbox` to see which ports this checkout owns, and check whether another sandbox slot already holds the one that collides. See `docs/engineering/parallel-sandboxes.md`.

**MinIO bucket missing:** If `pnpm run setup` finished but the `file-uploads` bucket isn't there, the `minio-init` container errored. Re-run `pnpm run setup`, or just the bucket step with `zx scripts/sandbox.ts infra bucket-init` from the repo root. It is gated behind the `init` profile so a plain `pnpm infra:up` won't re-trigger it.

**`pnpm run setup` is idempotent** and safe to re-run, with one caveat: it never overwrites existing `.env` files, and if their ports no longer match the worktree's sandbox slot the env preflight stops it (fix the named ports in place, or delete both `.env` files and re-run). Day-to-day after first setup, only `pnpm infra:up` (start containers) and `pnpm dev` (start app) are needed.

### After doc Step 4 (Fill in Clerk keys)

Don't read or write `.env` files. Verify by starting the app in the next step — invalid Clerk keys produce clear errors at startup.

### After doc Step 5 (Start the app)

**Verify (in a separate terminal — `pnpm dev` occupies the current one):**

```bash
curl -s http://localhost:3000/health                                  # liveness
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001          # frontend HTTP 200
```

For a deeper check that pings Postgres + Redis + S3 with per-service latency, use `http://localhost:3000/health/detailed`. This endpoint returns 503 if any backing service is down — intentionally **not** wired to Render's liveness probe so a downstream outage doesn't restart-loop the API.

The worker (BullMQ) starts automatically with `pnpm dev`. If they want it in a separate terminal: `pnpm --filter server dev:worker`.

### After doc Step 6 (Verify the app works)

**Blank page or error:** Check the `pnpm dev` terminal output. Most common cause: invalid Clerk keys in either `.env` file.

**Bonus check — BullMQ admin dashboard:** `http://localhost:3000/admin/jobs` shows queues/jobs/failures. Requires the signed-in user to have `role: admin` (set via Clerk's `unsafeMetadata`). Only mounted when `NODE_ENV=development` — off in `test`/`staging`/`production` by design.

### Apollo plugin (optional, not blocking)

If the engineer uses Claude Code, point them at `docs/setup/integrations/APOLLO.md` — installs the apollo plugin and gives them `/apollo:cl-feature`, `/apollo:cl-fix`, `/apollo:cl-finish`, etc. The install uses Claude Code slash commands that can't be run from bash, so this is a manual step. Not blocking — they can do it any time.

---

## Phase 1 Complete

When the backend health check returns OK, the frontend loads, the engineer can sign in via Clerk, and (for forks) `pnpm rename` has been committed.
