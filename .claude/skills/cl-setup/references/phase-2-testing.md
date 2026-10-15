# Phase 2: Testing

**Goal:** All test suites passing — server unit, server integration, web unit, and (optionally) E2E.

**Doc:** `docs/setup/integrations/RUNNING_TESTS.md` — follow this doc step by step. This reference only adds verification and troubleshooting.

---

## State Check

```bash
pnpm infra:test:up 2>/dev/null                              # Test database running? (doc Step 2)
pnpm test:server:unit 2>&1 | tail -5                        # Unit tests passing? (doc Step 1)
```

---

## Verification & Troubleshooting

### After doc Step 1 (Server unit tests)

**Verify:** `pnpm test:server:unit` — all tests pass, exit code 0.

**Build errors:** Run `pnpm build` first to compile packages, then retry.

### After doc Step 2 (Test database setup)

**You usually don't need to run this manually.** `pnpm test:server:integration` auto-starts the test DB. The standalone `pnpm infra:test:up` / `pnpm infra:test:down` commands are for cases when the engineer wants the DB running between test runs (faster iteration) or wants to inspect it with an external client.

**Verify (only if running manually):** `pnpm infra:test:up` completes with the test DB healthy on port 5434:

```bash
docker compose -f docker-compose.test.yml ps
```

**`TEST_DATABASE_URL` check:** Confirm `apps/server/.env` has it. Should already be there from `pnpm setup` (which copies `.env.example`). Format: `postgresql://postgres:postgres@localhost:5434/<project>_test`.

**Port 5434 in use:** Same fix as the dev DB on 5433 — edit `ports:` in `docker-compose.test.yml` and update `TEST_DATABASE_URL` in `apps/server/.env`.

### After doc Step 3 (Server integration tests)

**Verify:** `pnpm test:server:integration` — all tests pass, exit code 0.

**Connection refused on 5434:** Test DB not running — go back to doc Step 2.

**`TEST_DATABASE_URL` not set:** Check `apps/server/.env`.

**Relation does not exist:** The global setup in `vitest.global-setup.ts` handles schema creation. Check test output for setup errors.

### After doc Step 4 (Web unit tests)

**Verify:** `pnpm test:web` — all tests pass, exit code 0.

**Package errors:** Run `pnpm build` to compile `@repo/shared`, `@repo/ui`, etc.

### After doc Step 5 (E2E tests — optional)

E2E is **not in CI** — optional for day-to-day work.

**One-time setup:** `pnpm exec playwright install chromium` (downloads the browser binary).

**Disable Clerk Client Trust on the dev instance.** Every Playwright run looks like a "new device" to Clerk, which triggers an email verification code and blocks the test. In the Clerk Dashboard for the **development** instance: **Configure → Email, phone, username → Password tab → turn off Client Trust**. Production instances should keep it enabled.

**Test credentials:** E2E needs a dedicated Clerk test user. Create one in the dashboard with a strong, unique password (Clerk rejects passwords found in public breach databases — common ones will fail at sign-in), then paste credentials into `apps/web/.env`:

```
E2E_CLERK_USER_USERNAME=<test-user-email>
E2E_CLERK_USER_PASSWORD=<test-user-password>
```

**Run:** `pnpm test:e2e` (auto-starts dev servers), `pnpm test:e2e:ui` for the interactive debugger, `pnpm test:e2e:report` to view the HTML report after a run.

### Final verification

**Run:** `pnpm test` — runs server unit + integration + web unit via Turbo (not E2E).

---

## Phase 2 Complete

When `pnpm test` passes. Optionally, `pnpm test:e2e` passes too.

**Stopping test infrastructure:** `pnpm infra:test:down`
