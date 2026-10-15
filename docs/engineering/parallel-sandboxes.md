# Parallel Sandboxes

Every checkout of a Genesis-derived repo on this machine runs in its own
sandbox slot: its own ports, its own Docker containers, its own volumes.
Slots are allocated machine-wide, not per repository, so worktrees of one
product and separate products forked from Genesis all coexist without
fighting over the same base ports. Whichever checkout registers first keeps
slot 0 and today's exact ports; every other checkout gets the next free
slot, offset by `N x 100`. Run `pnpm sandbox` in any checkout to see its
slot, ports, and URLs.

## Port table

| Service | Base (slot 0) | Slot 1 | Slot 2 |
|---|---|---|---|
| Server | 3000 | 3100 | 3200 |
| Web | 3001 | 3101 | 3201 |
| Postgres | 5433 | 5533 | 5633 |
| Test Postgres | 5434 | 5534 | 5634 |
| Redis | 6379 | 6479 | 6579 |
| Test Redis | 6380 | 6480 | 6580 |
| MinIO API | 9000 | 9100 | 9200 |
| MinIO console | 9001 | 9101 | 9201 |
| Test MinIO API | 9002 | 9102 | 9202 |
| Test MinIO console | 9003 | 9103 | 9203 |

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

- A registry file at `~/.genesis/sandboxes.json` (override with the
  `GENESIS_SANDBOX_REGISTRY` environment variable) maps each checkout's
  absolute path to a slot number, across every Genesis-derived checkout on
  the machine, not just this repo. An entry is freed only when its path no
  longer exists on disk: an idle checkout still owns generated `.env` files
  and stopped containers bound to its ports, so handing its slot to another
  checkout would recreate the collision the registry exists to prevent.
- Claiming a slot takes an exclusive lock on `~/.genesis/sandboxes.json.lock`
  for the read-compute-write, so two commands starting at once cannot both
  claim the same free slot. A lock left behind by a killed process is
  reclaimed after 30 seconds.
- Slot 0 has no special status. Every checkout, main or linked, claims the
  lowest free slot starting at 0. Slots are sticky, so whichever checkout
  registered first keeps slot 0 and the documented default ports; the next
  checkout gets slot 1, and so on.
- Compose project names are scoped by product, read from the root
  `package.json` `name` field (which `pnpm rename` rewrites per fork) and
  sanitized to a compose-safe string. Slot 0's dev stack keeps the plain
  sanitized basename of the main checkout directory, so pre-existing
  containers and volumes stay addressable; slot 0's test stack is
  `<product>-test`. Slot n at or above 1 is `<product>-s<n>` for dev and
  `<product>-s<n>-test` for test. A fork that has never run `pnpm rename`
  still has the product name `genesis`, so two such forks share compose
  project names; ports still stay disjoint through the global registry, so
  only the project name overlaps.
- `--slot <n>` beats `GENESIS_SLOT`, which beats the registry. Overrides
  never write to the registry.

## Gotchas

- `.env` files are generated once by `pnpm setup` and are never overwritten
  automatically. If a worktree's `.env` predates this feature, or you need
  to re-slot a worktree, delete `apps/server/.env` and `apps/web/.env` and
  re-run `pnpm setup`.
- Slots are first-come on an empty registry, so the first checkout to run a
  sandbox command claims 0. Run one in your main checkout before any linked
  worktree if you want it to keep the default ports. Getting this wrong is
  loud, not silent: the env preflight refuses to start and names the ports
  it expected.
- A registry entry is freed on path absence, so a checkout living on an
  unmounted external or network volume reads as gone and its slot can be
  reused while its `.env` still points at those ports. Remount before
  running sandbox commands elsewhere, or pin the slot with `--slot`.
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
- The wrapper owns every connection string for the test stack, not just
  `TEST_DATABASE_URL`. `pnpm test:server:integration`, `pnpm infra:test:up`,
  and `pnpm infra:test:down` all resolve the slot once and export
  `TEST_DATABASE_URL`, `REDIS_URL`, `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`,
  `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` pointed at that slot's
  ephemeral test stack. Exported values beat dotenv, so a test run can never
  fall back to the dev values sitting in `.env`.
- `apps/server/vitest.global-setup.ts` enforces this: if `REDIS_URL` or
  `S3_ENDPOINT` is set without the wrapper's `GENESIS_TEST_INFRA` marker, it
  throws before anything connects. This is what makes running
  `pnpm --filter server test:integration` by hand fail loudly instead of
  quietly writing into your dev Redis or the dev bucket; use
  `pnpm test:server:integration` instead.
- The Clerk dev instance and its e2e test users are shared across every
  sandbox. Concurrent Playwright runs in different worktrees can race on
  the same test user.
- CI never invokes the sandbox wrapper at all. The server integration
  workflow starts its database as a GitHub Actions service container and
  calls `pnpm --filter server test:integration` directly with its own
  `TEST_DATABASE_URL`, so no slot or registry is involved.
