# Running Tests Locally

This document covers how to run the full test suite locally. Read [`LOCAL_ENV.md`](../LOCAL_ENV.md) first — you need a working local setup before running tests.

---

## Test Suites

| Suite | Command | What it tests | Infrastructure needed |
|-------|---------|---------------|----------------------|
| Server unit | `pnpm test:server:unit` | Business logic, utilities, handlers (mocked DB) | None |
| Server integration | `pnpm test:server:integration` | Full request flow against a real database, cache, and object store | Test Postgres, Redis, and MinIO (all ephemeral), auto-started |
| Web unit | `pnpm test:web` | React components, hooks, utilities | None (jsdom) |
| E2E | `pnpm test:e2e` | Full browser flow through the running app | Both dev servers + Playwright browsers |

To run everything except E2E:

```bash
pnpm test
```

---

## Step 1: Server unit tests

These work immediately if your local setup is complete:

```bash
pnpm test:server:unit
```

No database or external services needed — these tests mock the database layer.

---

## Step 2: Set up the test infrastructure

Integration tests run against a real Postgres database, a real Redis instance, and a real MinIO bucket, all separate from your development stack. The test command automatically starts and initializes this stack, but you can also manage it manually:

```bash
pnpm infra:test:up      # Start test Postgres, Redis, and MinIO (auto-runs before integration tests)
pnpm infra:test:down    # Stop the test stack
```

This starts, on the sandbox slot's test ports (slot 0 shown, separate from the dev stack on 5433/6379/9000/9001):
- **Postgres** on **5434**: database `genesis_test`, user `postgres`, password `postgres`.
- **Redis** on **6380**.
- **MinIO** on **9002** (API) and **9003** (console).

Verify it's running:

```bash
docker compose -p "$(pnpm sandbox --json | jq -r .composeProjects.test)" -f docker-compose.test.yml ps
```

Run `pnpm sandbox` to see this checkout's slot, ports, and compose project names.

> **Why a separate stack?** Integration tests run real queries, cache writes, and file uploads. A stack on different ports means tests never interfere with your development data. Nothing in it uses a persistent volume, so it's ephemeral by design.

### Connection strings

`pnpm test:server:integration` exports `TEST_DATABASE_URL`, `REDIS_URL`, `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` for the resolved sandbox slot, so the whole run targets the same ephemeral stack it just started. These exported values beat `apps/server/.env`, so a test run can never fall back to your dev Redis or dev bucket.

`apps/server/vitest.global-setup.ts` enforces this with a safety check: if `REDIS_URL` or `S3_ENDPOINT` is set without the wrapper's marker, it throws before any test connects, instead of silently writing into your dev infrastructure.

---

## Step 3: Server integration tests

`pnpm test:server:integration` is the supported entry point. It resolves the sandbox slot, brings up the ephemeral test stack (including creating the test bucket), and then runs vitest against it:

```bash
pnpm test:server:integration
```

Integration tests use a global setup file (`vitest.global-setup.ts`) that handles schema creation against the test database automatically.

Running vitest directly (`pnpm --filter server test:integration`) is refused: without the wrapper's exports, the safety check in `vitest.global-setup.ts` throws rather than letting the run connect to your dev Redis and MinIO.

**Troubleshooting:**

- **Connection refused on a test port** (5434, 6380, or 9002 at slot 0): the test stack isn't running. Run `pnpm infra:test:up`.
- **`TEST_DATABASE_URL` not set**: only possible when invoking vitest directly, since `pnpm test:server:integration` exports the slot's value. For direct runs, the config loads `.env` via dotenv, so make sure the variable exists in `apps/server/.env`. Note the safety check above still blocks the run if `REDIS_URL`/`S3_ENDPOINT` are also set there without the wrapper's marker.
- **Relation does not exist** — The global setup should handle schema creation. If it fails, check the test output for setup errors.

---

## Step 4: Web unit tests

```bash
pnpm test:web
```

These run in jsdom (simulated browser) and don't need any running services.

---

## Step 5: E2E tests (optional)

E2E tests use Playwright to run a real browser against the running app. They're optional for day-to-day development and are not currently part of the CI pipeline.

### Install Playwright browsers

One-time setup — downloads the Chromium browser binary:

```bash
pnpm exec playwright install chromium
```

### Disable Client Trust

Clerk's **Client Trust** feature requires email verification when signing in from an unrecognized device. Since Playwright runs a fresh headless browser for every test, every sign-in looks like a "new device" and triggers a verification code — blocking automated tests.

Disable it for your **development** instance:

1. Clerk Dashboard → **Configure** → **Email, phone, username** → **Password** tab
2. Turn off **Client Trust**

This only affects local/dev — production instances should keep it enabled.

### Set up test credentials

E2E tests need a dedicated Clerk test user. Create a user in your Clerk dashboard with known credentials, then add them to `apps/web/.env`:

```
E2E_CLERK_USER_USERNAME=<your-test-user-email>
E2E_CLERK_USER_PASSWORD=<your-test-user-password>
```

> **Tip:** Use a strong, unique password. Clerk blocks passwords found in public breach databases — common or simple passwords will be rejected at sign-in.

### Run E2E tests

The Playwright config automatically starts the dev servers if they aren't already running.

```bash
pnpm test:e2e
```

Or with the interactive Playwright UI for debugging:

```bash
pnpm test:e2e:ui
```

View the HTML report after a run:

```bash
pnpm test:e2e:report
```

---

## Stopping test infrastructure

```bash
pnpm infra:test:down               # Stop the test stack
pnpm infra:test:down --volumes     # Stop and delete test data
```

---

## CI vs Local

In CI (GitHub Actions), the test database is provisioned as a service container in the workflow YAML, so no manual setup is needed. The CI test database runs on port 5432 (not 5434) with its own connection string defined in the workflow file. Your local `TEST_DATABASE_URL` is only used locally. CI never invokes the sandbox wrapper and does not run Docker Compose.

If you add an integration test that needs Redis or object storage, give the workflow its own service containers and set `GENESIS_TEST_INFRA=1` in its `env:` block. The safety check above keys on where the connection strings came from rather than what they contain, so a CI job pointing at its own throwaway services still has to opt out of it explicitly.

---

## Mobile E2E (Maestro)

End-to-end tests for `apps/mobile` run with Maestro against an **iOS Simulator**
(Maestro does not support physical iOS devices).

### One-time setup

1. Install Maestro (official script — not Homebrew):
   ```bash
   curl -fsSL "https://get.maestro.mobile.dev" | bash
   ```
   Ensure `$HOME/.maestro/bin` is on your `PATH`, then verify with `maestro --version`.
2. Configure the app's own env in `apps/mobile/.env` — copy `apps/mobile/.env.example`
   and fill in real values. The `EXPO_PUBLIC_*` vars (`EXPO_PUBLIC_SERVER_URL`,
   `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`) are **required**: they are inlined into the build,
   and without them the app throws on launch and renders a blank screen before any UI
   appears. Each git worktree needs its own `.env` (it is gitignored and not shared).
3. Provision a dedicated Clerk **dev-instance** test user and add its credentials to the
   same `apps/mobile/.env`:
   ```bash
   E2E_CLERK_USER_USERNAME="e2e-testing@example.com"
   E2E_CLERK_USER_PASSWORD="..."
   ```
   These are plain vars (no `EXPO_PUBLIC_` prefix) and are never bundled into the app.

### Running the suite

Maestro cold-launches the app with no Metro connection, so it must run against a
**standalone Release build** with the JS bundle embedded. A debug dev client (plain
`expo run:ios`) only loads JS from Metro and comes up blank under Maestro.

1. Build and install a Release build into a booted simulator (rebuild after changing
   `.env` — `EXPO_PUBLIC_*` vars are inlined at build time):
   ```bash
   open -a Simulator
   pnpm --filter mobile exec expo run:ios --configuration Release
   ```
   No Metro / `pnpm dev:mobile` needed — the Release build is self-contained.
2. Run every flow under `apps/mobile/e2e/flows/`:
   ```bash
   pnpm test:mobile:e2e
   ```

The `testID` convention that flows follow is documented in `apps/mobile/e2e/README.md`.

---

### Mobile E2E in CI

Maestro E2E runs **on merge to `develop`** (when `apps/mobile/**` or its shared
packages changed), driven by `.github/workflows/mobile-e2e.yml`. GitHub Actions
triggers an EAS Workflow (`apps/mobile/.eas/workflows/e2e.yml`) via
`eas workflow:run --wait`; the workflow **builds** an unsigned iOS-simulator +
Android-APK binary (with the `preview` env injected) and runs the flows in
`apps/mobile/e2e/flows/**` on managed devices.

- **Why on-merge (not per-PR):** each run does a full EAS build of both
  platforms (no fingerprint reuse — a reused native binary carries stale JS/env,
  and applying current JS to it needs EAS Update/OTA, which is deferred). Per-PR
  would be too costly/slow. The `--wait` flag makes the GitHub check reflect the
  real EAS result (not a submit-time false-green).
- **Status:** non-blocking (informational) — a post-merge signal on `develop`.
  Promote to a gate only once it is proven stable across several merges.
- **Bootstrap:** requires `EXPO_TOKEN` (org-scoped) + the `preview` EAS env vars
  (`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_SERVER_URL`) — see the
  "Implemented Pipeline (bootstrap)" section of
  `docs/engineering/mobile-cicd-pipeline-options.md`. Until `EXPO_TOKEN` is set,
  the CI job is a green no-op.
- **Cost:** the `maestro` job requires a **paid EAS plan** (Starter ~$19/mo);
  each on-merge run spends ~2 build credits (iOS + Android). No Apple/Google
  store accounts are required (simulator / internal builds only).
- **Deployment (store submit, OTA) is not part of this pipeline** — deferred.
  Reuse + OTA (to cut per-run build cost) is a tracked follow-up.
