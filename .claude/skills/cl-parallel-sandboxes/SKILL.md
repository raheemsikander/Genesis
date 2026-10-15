---
name: cl-parallel-sandboxes
description: Use when working in a git worktree of this repo, or when starting infra (pnpm infra:up), dev servers (pnpm dev), integration tests, or Playwright e2e. Every worktree runs in its own sandbox slot with its own ports, containers, and volumes. Trigger before assuming any port number (3000, 3001, 5433, 5434, 6379, 6380, 9000, 9001, 9002, 9003), before starting a second copy of the app, when a port is already in use, or when setting up a fresh worktree for parallel work.
---

# Parallel Sandboxes

Every checkout gets a **sandbox slot**, allocated machine-wide across every
Genesis-derived checkout, not just this repo's worktrees. All infra/dev/test
commands are slot-aware automatically, so never hardcode ports: two
checkouts running the numbers you remember from last time will collide.

## Fresh worktree checklist

1. `pnpm install`
2. `pnpm setup`. Generates slot-aware `.env` files, starts this slot's
   Postgres/Redis/MinIO, creates the bucket, runs migrations.
3. `pnpm dev`

## Rules

- **Never assume ports.** Run `pnpm sandbox --json` and read `ports`/`urls`
  from the output. Slot 0 has the documented defaults, but it isn't
  guaranteed to be the main checkout: whichever checkout registers first
  keeps it. Other slots are offset by slot times 100.
- All of these are already slot-aware, just run them: `pnpm infra:up`,
  `pnpm infra:down [--volumes]`, `pnpm infra:test:up`, `pnpm infra:test:down`,
  `pnpm dev`, `pnpm test:server:integration`, `pnpm test:e2e`.
- Override a slot explicitly with `GENESIS_SLOT=<n>` or `--slot <n>` to
  operate on **another sandbox's stack** with `pnpm sandbox`,
  `pnpm infra:down`, `pnpm infra:test:up`, and `pnpm infra:test:down`, for
  example tearing it down from a different worktree. `pnpm infra:up` and
  `pnpm dev` run the env preflight, so overriding their slot requires
  `--skip-env-check`: the app reads connection strings from its own `.env`,
  and the check blocks the run when those files belong to another slot.
- If `.env` files exist but predate the sandbox model (wrong ports for the
  slot), the same preflight fails before `pnpm dev` and `pnpm infra:up` and
  names the offending keys, with their expected ports. Fix those ports in
  place, or delete `apps/server/.env` and `apps/web/.env`, re-run
  `pnpm setup`, and paste the Clerk keys back in. Only `TEST_DATABASE_URL`
  is exempt; `REDIS_URL` and `S3_ENDPOINT` are still checked, because the dev
  server does read them from `.env`. Test runs are a separate matter:
  `pnpm test:server:integration` exports the whole ephemeral test stack for
  the slot, overriding all three, so the `.env` values never reach one.
  Running vitest directly without those exports is refused by a safety check
  in `vitest.global-setup.ts`. For an intentional custom target (a remote
  database, a shared service), bypass the preflight with `--skip-env-check`
  or `GENESIS_SKIP_ENV_CHECK=1`.
- Shared across all sandboxes: the Clerk dev instance and its e2e test
  users. Concurrent e2e runs can race on the same test user.

Full model and port table: `docs/engineering/parallel-sandboxes.md`.
