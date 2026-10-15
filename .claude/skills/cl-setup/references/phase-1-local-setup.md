# Phase 1: Local Setup

**Goal:** App running at `http://localhost:3001` with backend healthy at `http://localhost:3000/health`.

**Doc:** `docs/setup/LOCAL_ENV.md` — follow this doc step by step. This reference only adds verification and troubleshooting.

---

## State Check

Run these first to see what's already done. Skip any doc step that's already passing.

```bash
node --version                    # Need >= 24 (doc prerequisites)
pnpm --version                    # Need >= 10 (doc prerequisites)
docker --version                  # Need Docker installed (doc prerequisites)
docker info > /dev/null 2>&1      # Docker Desktop running? (doc Step 3)
docker compose ps                 # Infrastructure services running? (doc Step 3)
ls apps/server/.env apps/web/.env 2>/dev/null   # Env files exist? (doc Step 4)
curl -s http://localhost:3000/health 2>/dev/null  # Backend running? (doc Step 7)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null  # Frontend running? (doc Step 7)
```

---

## Verification & Troubleshooting

### Prerequisites (before doc Step 1)

**Verify:** `node --version` >= 24, `pnpm --version` >= 10, `docker --version` exists.

**Node.js wrong version:** Ask what version manager they use (nvm, fnm, volta) and suggest the appropriate install command. Don't prescribe one.

**IMPORTANT: Node.js must be on the correct version BEFORE running `pnpm install`.** pnpm install compiles native modules against the active Node version. If the engineer switches Node versions after installing, they'll hit cryptic native module errors. Verify Node is >= 24 and block until it is.

**pnpm missing:** Check the version in the `packageManager` field of `package.json`, then run `corepack enable && corepack prepare pnpm@<version> --activate` or `npm install -g pnpm@<version>`.

**Docker missing:** Direct to Docker Desktop download. Wait — outside the skill's scope.

### After doc Step 1 (Clone and install)

**Verify:**
```bash
ls node_modules/.pnpm 2>/dev/null | head -1
```

### After doc Step 3 (Docker services)

**Pre-check:** `docker info > /dev/null 2>&1` — Docker Desktop must be running, not just installed.

**Verify:** `docker compose ps` — all three services (postgres, redis, minio) should show healthy/running.

**Port 5432 in use:** `lsof -i :5432`. The doc explains how to remap the port if another PostgreSQL is running.

### After doc Step 4 (Environment variables)

Don't read or write `.env` files. Verification happens when the app starts (doc Step 7).

**No Clerk account yet:** Direct to doc Step 2. Wait for them.

### After doc Step 6 (Database migrations)

**Verify:** `pnpm db:migrate` exits with code 0.

Then confirm tables were actually created by connecting to the database:
```bash
docker exec -i $(docker compose ps -q postgres) psql -U genesis -d genesis -c '\dt'
```
This should list the migration tables and application tables (e.g., `users`, `files`). If the output shows no relations, migrations did not apply correctly.

**Connection refused:** Docker services aren't running — go back to doc Step 3.

**Tables already exist:** `docker compose down -v && docker compose up -d && pnpm db:migrate` (per the doc).

### After doc Step 7 (Start the app)

**Verify (in separate terminal):**
```bash
curl -s http://localhost:3000/health
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001
```

### After doc Step 8 (Verify the app works)

**Blank page or error:** Check `pnpm dev` terminal output. Most common cause: invalid Clerk keys.

### After doc Step 9 (Claude Code toolkit)

This is a manual step — the install uses Claude Code slash commands that can't be run or verified from bash. Remind the engineer:

> If you use Claude Code, install the apollo plugin now. See `docs/setup/integrations/APOLLO.md` for the commands. This gives you workflow skills like `/apollo:cl-feature` and `/apollo:cl-finish`.

Then move on — this step is not blocking and can be completed later.

---

## Phase 1 Complete

When the backend health check returns OK, the frontend loads, and the engineer can sign in.
