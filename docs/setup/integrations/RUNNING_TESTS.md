# Running Tests Locally

This document covers how to run the full test suite locally. Read [`LOCAL_ENV.md`](../LOCAL_ENV.md) first — you need a working local setup before running tests.

---

## Test Suites

| Suite | Command | What it tests | Infrastructure needed |
|-------|---------|---------------|----------------------|
| Server unit | `pnpm test:server:unit` | Business logic, utilities, handlers (mocked DB) | None |
| Server integration | `pnpm test:server:integration` | Full request flow against a real database | Test PostgreSQL (port 5433) — auto-started |
| Web unit | `pnpm test:web` | React components, hooks, utilities | None (jsdom) |
| E2E | `pnpm test:e2e` | Full browser flow through the running app | Both dev servers + Playwright browsers |

To run everything except E2E:

```bash
pnpm test
```

---

## Step 1 — Server unit tests

These work immediately if your local setup is complete:

```bash
pnpm test:server:unit
```

No database or external services needed — these tests mock the database layer.

---

## Step 2 — Set up the test database

Integration tests run against a real PostgreSQL database, separate from your development database. The test command automatically starts the test database, but you can also manage it manually:

```bash
pnpm infra:test:up      # Start test database (auto-runs before integration tests)
pnpm infra:test:down    # Stop test database
```

This starts a PostgreSQL instance on **port 5433** (not 5432) with:
- **Database:** `genesis_test`
- **User:** `postgres`
- **Password:** `postgres`

Verify it's running:

```bash
docker compose -f docker-compose.test.yml ps
```

> **Why a separate database?** Integration tests run real queries and may create/drop tables. A separate database on a different port means tests never interfere with your development data. The test database has no persistent volume — it's ephemeral by design.

### TEST_DATABASE_URL

Your `apps/server/.env` needs `TEST_DATABASE_URL` pointing to the test database. If you copied from `.env.example`, it should already be there:

```
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/genesis_test
```

---

## Step 3 — Server integration tests

With the test database running:

```bash
pnpm test:server:integration
```

Integration tests use a global setup file (`vitest.global-setup.ts`) that handles schema creation against the test database automatically.

**Troubleshooting:**

- **Connection refused on port 5433** — Test database isn't running. Run `pnpm infra:test:up`.
- **`TEST_DATABASE_URL` not set** — The integration test config loads `.env` via dotenv. Make sure the variable exists in `apps/server/.env`.
- **Relation does not exist** — The global setup should handle schema creation. If it fails, check the test output for setup errors.

---

## Step 4 — Web unit tests

```bash
pnpm test:web
```

These run in jsdom (simulated browser) and don't need any running services.

---

## Step 5 — E2E tests (optional)

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
pnpm infra:test:down                                 # Stop test database
docker compose -f docker-compose.test.yml down -v    # Stop and delete test data
```

---

## CI vs Local

In CI (GitHub Actions), the test database is provisioned as a service container in the workflow YAML — no manual setup needed. The CI test database runs on port 5432 (not 5433) with its own connection string defined in the workflow file. Your local `TEST_DATABASE_URL` is only used locally.
