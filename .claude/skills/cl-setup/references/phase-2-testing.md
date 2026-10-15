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

**Verify:** `pnpm infra:test:up` — should complete successfully with test DB healthy on port 5434.

**`TEST_DATABASE_URL` check:** Ask the engineer to confirm `apps/server/.env` has it. Should already be there if copied from `.env.example`.

### After doc Step 3 (Server integration tests)

**Verify:** `pnpm test:server:integration` — all tests pass, exit code 0.

**Connection refused on 5434:** Test DB not running — go back to doc Step 2.

**`TEST_DATABASE_URL` not set:** Check `apps/server/.env`.

**Relation does not exist:** The global setup in `vitest.global-setup.ts` handles schema creation. Check test output for setup errors.

### After doc Step 4 (Web unit tests)

**Verify:** `pnpm test:web` — all tests pass, exit code 0.

**Package errors:** Run `pnpm build` to compile `@repo/shared`, `@repo/ui`, etc.

### After doc Step 5 (E2E tests — optional)

**Quick setup check:** `pnpm exec playwright install chromium` if browsers not installed.

Remind about Clerk test credentials in `apps/web/.env`.

### Final verification

**Run:** `pnpm test` — runs server unit + integration + web unit via Turbo (not E2E).

---

## Phase 2 Complete

When `pnpm test` passes. Optionally, `pnpm test:e2e` passes too.

**Stopping test infrastructure:** `pnpm infra:test:down`
