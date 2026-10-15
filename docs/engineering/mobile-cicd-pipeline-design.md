# Mobile CI/CD Pipeline — Design (PR checks + Maestro E2E)

> **Ticket:** Implements the GENESIS-171 CI/CD spike recommendation (`docs/engineering/mobile-cicd-pipeline-options.md`).
> **Status:** Design / spec — approved for implementation planning.
> **Scope:** CI for `apps/mobile` (Expo SDK 56 / React Native). **Deployment (store submit, OTA) is explicitly deferred.**
> **Date:** 2026-06-29

## Summary (BLUF)

Build the mobile CI pipeline in two layers, with **GitHub Actions as the single control plane**:

1. **Layer A — PR checks (GitHub Actions, Linux):** a dedicated, path-filtered `mobile-tests.yml` that *owns* mobile's `tsc --noEmit` (type-check) and `expo export` (bundle smoke test). Mobile is scoped *out* of the unfiltered turbo `check-types`/`build` in `lint.yml` / `build.yml` so those gates run only here. Linting stays on Biome, which runs repo-wide (`pnpm biome check .` in `lint.yml`) and already covers mobile — no `expo lint` step.

2. **Layer B (E2E slice only) — Maestro on EAS-managed devices:** per-PR Maestro E2E (iOS simulator + Android) using EAS Workflows' **fingerprint reuse**, triggered from GitHub Actions via `eas workflow:run`. Includes the **minimal EAS bootstrap** required to run it.

**Deployment is out of scope** (no `eas submit`, no store accounts, no OTA/EAS Update, no release automation). The E2E builds are **unsigned iOS-simulator + Android** builds — test infrastructure, not deployment.

## Scope boundary

### In scope

- `mobile-tests.yml` — PR checks on Linux runners (lint, type-check, bundle export).
- Scope mobile out of the repo-wide `lint.yml` / `build.yml`.
- Minimal EAS bootstrap (Expo account/org, `EXPO_TOKEN`, `eas.json` `e2e` profile, `projectId`/`owner` in `app.json`).
- `apps/mobile/.eas/workflows/e2e.yml` — EAS Workflow with fingerprint/`get-build` + `maestro` jobs.
- `mobile-e2e.yml` — GitHub Actions workflow that triggers the EAS workflow per-PR via `eas workflow:run`.
- Docs: CI E2E section in `docs/setup/integrations/RUNNING_TESTS.md`; implemented-pipeline overview doc.

### Out of scope (deferred — "deployment")

- EAS `production` / `preview` build profiles, `eas submit`, store accounts (Apple $99 / Google $25), store credentials.
- EAS Update / OTA, channels, `runtimeVersion` policy, branch→channel mapping, mobile path in `deploy.yml`.
- `jest-expo` unit-test runner + unit tests (separate ticket). `mobile-tests.yml` ships with **no `test` job**.

## Layer A — `mobile-tests.yml` (PR checks, Linux)

- **Trigger:** `pull_request`, `paths`-filtered to `apps/mobile/**` plus the shared packages mobile imports (`packages/shared/**`, `packages/orpc-contracts/**`).
- **Setup:** mirrors `web-tests.yml` — `actions/checkout@v6`, `pnpm/action-setup@v6`, `actions/setup-node@v6` (Node 24, pnpm cache), `pnpm install --frozen-lockfile`.
- **Steps:**

  | Step | Command |
  |---|---|
  | Type-check | `pnpm --filter mobile check-types` (`tsc --noEmit`) |
  | Bundle smoke test | `pnpm --filter mobile build` (`expo export`, both platforms) |

- **Linting:** mobile is linted by **Biome**, not Expo's ESLint (per `apps/mobile/CLAUDE.md`: "Biome, not the Expo lint defaults"). Biome runs repo-wide via `lint.yml` (`pnpm biome check .`), which already covers `apps/mobile`, so `mobile-tests.yml` adds no lint step (an `expo lint` step would scaffold an unwanted ESLint config and duplicate coverage).
- **Scoping change:** remove mobile from repo-wide turbo coverage so it is gated only in `mobile-tests.yml`. `lint.yml`'s `pnpm check-types` and `build.yml`'s `pnpm build` are turbo tasks; scope them to exclude mobile (e.g. `--filter '!mobile'`) so non-mobile PRs do not run mobile work and mobile PRs are covered here. (Biome stays repo-wide — it is the mobile linter.)
- **Accounts:** none required for this entire layer.
- **Note:** `env.ts` skips validation when `CI=true`, so `expo export` runs without real `EXPO_PUBLIC_*` values.

## Layer B (E2E) — Maestro via EAS Workflows + fingerprint reuse

> **⚠️ IMPLEMENTATION UPDATE (what actually shipped, GENESIS-171).** The sections below describe the *designed* fingerprint-reuse approach. During implementation it proved unworkable as a per-PR reuse pipeline, so the shipped workflow differs on three points (verified green on EAS):
> 1. **Always-build, not fingerprint reuse.** EAS auto-skips a job when a `needs` dependency is skipped — so on the reuse path the conditional `build` job's skip propagated to `maestro`, silently skipping the tests and reporting a **false green** (no `if:` condition overrides this in EAS). Separately, reused native binaries carry **stale JS/env** (the fingerprint covers native only), so a reused build wouldn't even have the current Clerk key / env. The shipped `e2e.yml` therefore **always builds** both platforms (Expo's official Maestro example) with `maestro` needing only `build` — guaranteeing the tests run against a fresh binary with current JS + env.
> 2. **Trigger: on merge to `develop`, not per-PR.** Since every run is a full build (~2 credits), per-PR is too costly; `mobile-e2e.yml` triggers on `push` to `develop`.
> 3. **Requires a paid EAS plan + `preview` env vars.** The `maestro` job is paywalled (undocumented — see options doc), and the `e2e` build needs `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` + `EXPO_PUBLIC_SERVER_URL` injected via the `preview` environment (the `build_*` jobs carry `environment: preview`), else the app crashes at startup.
>
> **Deferred follow-up:** restore fingerprint reuse via **EAS Update (OTA)** — reuse the native binary and deliver current JS as an OTA update — to cut the per-run build cost. That requires `runtimeVersion: "fingerprint"` + a channel + an `update` job (OTA infra, deferred with the rest of deployment). The `eas.json` `e2e` profile, the `preview` env wiring, and the bootstrap below all still apply.

### Concept

A React Native app is a **native binary shell** + a **JS bundle**. The shell is slow/expensive to build; the JS bundle is cheap; most PRs change only JS. A **fingerprint** (`@expo/fingerprint`) hashes everything that affects the native shell (native deps, config plugins, native config, `ios/`/`android/`, SDK version) and ignores JS. **Fingerprint reuse**: if a build with the current fingerprint already exists (JS-only PR), reuse that binary and skip the native compile; only PRs that change native code trigger a full build.

### Mechanism

- **`apps/mobile/.eas/workflows/e2e.yml`** — uses EAS Workflows' built-in **fingerprint / `get-build`** jobs and the pre-packaged **`maestro`** job, pointing at the existing flows in `apps/mobile/e2e/flows/**`.
- **`eas.json`** — single **`e2e`** build profile: `ios.simulator: true` (unsigned, no Apple account), Android internal/APK.
- **`mobile-e2e.yml`** (GitHub Actions) — `pull_request`-triggered, **path-filtered to `apps/mobile/**` + shared deps**, runs `eas workflow:run e2e.yml` authenticated with `EXPO_TOKEN`. GitHub Actions remains the trigger surface ("any workflow runs regardless of its `on:` key").

### Flow per PR

1. Compute fingerprint.
2. If a build with that fingerprint exists (common: JS-only PR) → **reuse**, skip native compile. Else → full `e2e`-profile build (one build credit/platform).
3. Run Maestro on iOS simulator + Android against the binary.

### Credentials

Clerk E2E test-user creds (`E2E_CLERK_USER_USERNAME` / `E2E_CLERK_USER_PASSWORD`) passed as **EAS secrets**. Not used by today's `app-launch` smoke flow but wired for future auth flows. CI invokes Maestro via the EAS `maestro` job; `apps/mobile/e2e/run.ts` remains the **local-dev** wrapper.

### Policy: non-blocking first

The per-PR E2E check ships **non-blocking / informational** (reports status, does not gate merge). Promote to a required check once it is proven stable. Rationale: E2E flakiness + EAS Free-tier 1-concurrency queueing should not stall merges on day one.

## Trade-offs accepted

- **Concurrency:** EAS Free tier = **1 build concurrency**. Per-PR with multiple open PRs causes queueing; iOS+Android run sequentially within a run. Tolerable for a small team; the paid fix is a concurrency add-on (~$50/slot), not free.
- **Cost shifts to EAS CI minutes:** JS-only PRs consume Maestro-job **CI minutes** (cheap) instead of build credits, but the Free allowance is limited. Realistic steady-state at per-PR volume: **~$19/mo (Starter)** once Free CI minutes are exhausted — cheaper per run than building every PR, with fast feedback. Native-changing PRs still spend one full build each.
- **No Apple/Google spend:** iOS uses an unsigned simulator build; Android uses an internal build. Neither requires store enrollment.

## Secrets & prerequisites

| Item | Purpose | Location |
|---|---|---|
| Expo account + org | Owns the EAS project (`projectId`, `owner` in `app.json`) | Expo dashboard (manual) |
| `EXPO_TOKEN` | Authenticates EAS CLI / `eas workflow:run` in CI | GitHub Actions secret |
| `E2E_CLERK_USER_USERNAME` / `E2E_CLERK_USER_PASSWORD` | Clerk E2E test-user creds for Maestro flows | EAS secrets (+ GitHub secret to pass through) |

**Manual prerequisites (owner):** create the Expo org, generate `EXPO_TOKEN`, create a throwaway Clerk dev-instance test user.

## Docs to update

- `docs/setup/integrations/RUNNING_TESTS.md` — add a "Mobile E2E in CI" section.
- A pipeline-overview doc (extend `docs/engineering/mobile-cicd-pipeline-options.md` or add `mobile-cicd-pipeline.md`) describing the implemented pipeline and the deferred deployment layer.

## Open dependency / sequencing

- **Layer A and all config** (workflow YAML, `eas.json`, `apps/mobile/.eas/workflows/e2e.yml`) can land **independently** of the Expo account.
- The **E2E workflow only goes green after** the EAS bootstrap (Expo account + `EXPO_TOKEN`) exists. Until then it is wired but unverified.
- **Upgrade path noted, not built:** moving deployment in later (store submit, OTA) reuses this same EAS project and `EXPO_TOKEN`; the `runtimeVersion: "fingerprint"` policy for OTA uses the same fingerprint mechanism.

## References

- `docs/engineering/mobile-cicd-pipeline-options.md` — the GENESIS-171 spike decision doc.
- [Run E2E tests on EAS Workflows with Maestro](https://docs.expo.dev/eas/workflows/examples/e2e-tests/)
- [Automating EAS CLI commands — `eas workflow:run`](https://docs.expo.dev/eas/workflows/automating-eas-cli/)
- Existing workflows: `.github/workflows/{web-tests,lint,build,deploy}.yml`.
- Existing Maestro harness: `apps/mobile/e2e/`.
