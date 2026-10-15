# Parallel Sandboxes

Every git worktree of this repo runs in its own sandbox slot: its own ports,
its own Docker containers, its own volumes. Slot 0 is the main checkout and
keeps today's exact ports for backward compatibility. Any other worktree
gets slot N, and every base port is offset by `N x 100`. Run `pnpm sandbox`
in any worktree to see its slot, ports, and URLs.

## Port table

| Service | Base (slot 0) | Slot 1 | Slot 2 |
|---|---|---|---|
| Server | 3000 | 3100 | 3200 |
| Web | 3001 | 3101 | 3201 |
| Postgres | 5433 | 5533 | 5633 |
| Test Postgres | 5434 | 5534 | 5634 |
| Redis | 6379 | 6479 | 6579 |
| MinIO API | 9000 | 9100 | 9200 |
| MinIO console | 9001 | 9101 | 9201 |

## How to use it

1. In a fresh worktree: `pnpm install`.
2. `pnpm setup`. This generates slot-aware `.env` files, starts this slot's
   infra (Postgres, Redis, MinIO), creates the storage bucket, and runs
   migrations.
3. `pnpm dev` to start the app.
4. `pnpm sandbox` (or `pnpm sandbox --json` for machine-readable output) to
   inspect the current worktree's slot, ports, and URLs at any time.
5. Override the resolved slot with `--slot <n>` on a script, or the
   `GENESIS_SLOT` environment variable, when you need to target a different
   sandbox with `pnpm sandbox`, `pnpm infra:down`, `pnpm infra:test:up`, or
   `pnpm infra:test:down` (for example, tearing down another worktree's
   stack). `pnpm infra:up` runs the env preflight below, so bringing up a
   foreign slot's stack additionally needs `--skip-env-check`. Pointing
   `pnpm dev` or the tests at a slot other than the worktree's own is a
   different matter: the app reads its connection strings from its own
   `.env`, so the env preflight blocks it.

## How it works

- A registry file at `<git common dir>/genesis-sandboxes.json` maps each
  worktree's absolute path to a slot number. It is pruned against
  `git worktree list` on every run, so stale entries for removed worktrees
  free up their slot automatically.
- The main worktree (the parent directory of the git common dir) is always
  slot 0 and is never written to the registry. Linked worktrees claim the
  lowest free slot at or above 1.
- Docker Compose project names are `genesis-s<n>` for the dev stack and
  `genesis-s<n>-test` for the test stack, for any slot at or above 1. Slot 0
  is pinned explicitly to a compose-safe name derived from the main
  checkout's directory basename, so targeting slot 0 works from any
  worktree's cwd (`--slot 0` or `GENESIS_SLOT=0`). For basenames that are
  already compose-safe (like `genesis-2`) this matches Docker's previous
  default naming and preserves pre-existing containers and volumes.
- `--slot <n>` beats `GENESIS_SLOT`, which beats the registry. Overrides
  never write to the registry.

## Gotchas

- `.env` files are generated once by `pnpm setup` and are never overwritten
  automatically. If a worktree's `.env` predates this feature, or you need
  to re-slot a worktree, delete `apps/server/.env` and `apps/web/.env` and
  re-run `pnpm setup`.
- **Env preflight.** `pnpm dev` and `pnpm infra:up` compare the `.env`-owned
  port-bearing keys (`PORT`, `CORS_ORIGIN`, `DATABASE_URL`, `REDIS_URL`,
  `S3_ENDPOINT` in `apps/server/.env`; `NEXT_PUBLIC_SERVER_URL` in
  `apps/web/.env`) against the resolved slot and refuse to start on a
  mismatch, naming each offending key and its expected port.
  `TEST_DATABASE_URL` is exempt: the wrapper exports it (see below), so the
  value in `.env` never reaches a test run. Without it a stale `.env` would quietly point a dev server
  at another sandbox's database. Values that are not `localhost` (a remote
  database, a LAN IP for device testing) are left alone. For an intentional
  custom setup, bypass the check with `--skip-env-check` or
  `GENESIS_SKIP_ENV_CHECK=1`. Missing `.env` files are skipped silently, so
  CI is unaffected.
- `TEST_DATABASE_URL` is the one connection string the wrapper owns:
  `pnpm test:server:integration` resolves the slot once, starts that slot's
  test stack, and exports the matching URL to vitest, so both halves of the
  run can never disagree. Every other connection string stays with `.env`.
- The Clerk dev instance and its e2e test users are shared across every
  sandbox. Concurrent Playwright runs in different worktrees can race on
  the same test user.
- CI always runs as slot 0: no registry is involved, and every port keeps
  its slot-0 default.
