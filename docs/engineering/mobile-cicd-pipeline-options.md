# Mobile App CI/CD Pipeline Options

> **Ticket:** GENESIS-171 (research spike). Implementation is tracked in separate follow-up tickets (see below).
> **Status:** Decision doc.
> **Scope:** CI/CD for `apps/mobile` (Expo SDK 56 / React Native, added in GENESIS-170).
> **Date:** 2026-06-18

## Table of Contents

- [Recommendation (BLUF)](#recommendation-bluf)
- [Current State](#current-state)
- [The Two Layers](#the-two-layers)
- [Options Evaluated](#options-evaluated)
- [Comparison Matrix](#comparison-matrix)
- [Recommended Approach](#recommended-approach)
- [Alternatives Considered (Beyond the Ticket)](#alternatives-considered-beyond-the-ticket)
- [Required Secrets & Accounts](#required-secrets--accounts)
- [Implementation Effort & Follow-up Ticket Outline](#implementation-effort--follow-up-ticket-outline)
- [Cost Appendix](#cost-appendix)
- [Out of Scope](#out-of-scope)
- [Sources](#sources)

---

## Recommendation (BLUF)

Run mobile CI/CD as **two layers**, keeping **GitHub Actions as the single control plane** and **offloading native work to Expo's managed cloud (EAS)**:

1. **PR checks (lint / type-check / test)** → **GitHub Actions** on Linux runners. A dedicated `mobile-tests.yml` (mirroring `web-tests.yml`) that runs `expo lint`, `tsc --noEmit`, `expo export` (bundle smoke test), and unit tests once a test runner exists. This is cheap (Linux minutes), co-located with the rest of CI, and most of it already runs incidentally today (see [Current State](#current-state)) — we just formalize and scope it.

2. **Native build / submit / OTA** → **EAS Build + EAS Submit + EAS Update**, invoked via the **EAS CLI from GitHub Actions** (`eas build`, `eas submit`, `eas update` with `EXPO_TOKEN`). EAS owns the macOS runners, Apple/Google signing, and certificate management — the parts that are painful to self-host. Triggering it from GitHub Actions (rather than adopting **EAS Workflows** as a second CI system) keeps one trigger surface, one secrets store, and one mental model consistent with `apps/web` and `apps/server`.

**Why not the alternatives, in one line each:**

- **EAS Workflows** — excellent and mobile-native, but introduces a *second* CI system to learn and maintain alongside the GitHub Actions we already standardize on. Strong fallback; revisit if GitHub Actions orchestration of EAS CLI becomes awkward.
- **Self-hosted / local native builds (fastlane + macOS runners)** — full control but by far the highest setup and ongoing maintenance cost (runner upkeep, Xcode/SDK upgrades, manual signing). Only justified at high build volume where per-build EAS pricing dominates — not our situation pre-launch.
- **PR-checks-only** — necessary but *not sufficient*; it covers correctness but ships nothing. It's layer (1) of the recommendation, not a complete answer.

**Start on the EAS Free tier** (15 iOS + 15 Android builds/month) for pre-launch development; upgrade to a paid plan only when build concurrency, the 45-min timeout, or EAS Update MAUs become real constraints (i.e. at launch). ⚠️ **Exception (verified during implementation):** running the **Maestro E2E job in CI requires a paid plan (Starter $19/mo) from day one** — the `maestro` job is not available on Free. This was missed in the original recommendation; see the CRITICAL CORRECTION callout in the [E2E (Maestro)](#e2e-maestro--runs-through-the-same-control-plane) section.

---

## Current State

What the repo does for mobile **today** (verified against the codebase, 2026-06-17):

| Area | Status | Detail |
|---|---|---|
| Type-check | ✅ Incidental | `lint.yml` runs `pnpm check-types` (turbo, unfiltered) → mobile's `tsc --noEmit` runs on every PR. |
| Biome lint | ✅ Incidental | `lint.yml` runs `pnpm biome check .` globally → covers `apps/mobile`. |
| JS bundle build | ✅ Incidental | `build.yml` runs `pnpm build` (turbo, unfiltered). Mobile's `build` script is `expo export --platform ios --platform android`, whose `dist/` output matches turbo's declared outputs — so the JS bundle export already runs in CI. |
| `expo lint` | ❌ Missing | Mobile has a `lint` script (`expo lint`) but no workflow invokes the turbo `lint` task; only Biome runs. |
| Unit tests | ❌ None exist | No `test` script, no test runner (no jest/vitest/testing-library), zero test files in `apps/mobile`. |
| Dedicated mobile workflow | ❌ Missing | No `mobile-tests.yml`. `server-tests.yml` and `web-tests.yml` are `--filter`-scoped to their apps; mobile has no equivalent. |
| Native build (iOS/Android binaries) | ❌ None | No `eas.json`, no EAS `projectId`/`owner` in `app.json`. App runs via Expo Go / local CLI only. |
| Store submission | ❌ None | Not automated; no App Store Connect / Play Console wiring. |
| OTA updates | ❌ None | No EAS Update config, channels, or `runtimeVersion`. |
| Deployment automation | ❌ Mobile excluded | `deploy.yml` (push to `main`/`develop`) migrates the DB + curls Render & Vercel. Infra in `infra/terraform/{vercel,render,cloudflare}`. No mobile path. |

**Existing GitHub Actions workflows** (all `pull_request`-triggered, Node 24 + pnpm): `build.yml`, `lint.yml`, `server-tests.yml`, `web-tests.yml`, `pr-title.yml`, plus `deploy.yml` (push to `main`/`develop`). None reference `mobile`.

**Takeaway:** the PR-check layer is ~70% there by accident (type-check, Biome, bundle export). The real gaps are (a) **no native build/submit/OTA path at all**, and (b) **no formal, scoped mobile test job** (and nothing to test yet).

---

## The Two Layers

The ticket asks the recommendation to cover two layers explicitly. They are genuinely independent and can be delivered in either order:

- **Layer A — PR checks:** correctness gates on every PR (lint, type-check, unit tests, bundle smoke test). Runs on cheap Linux runners. No Apple/Google accounts required.
- **Layer B — Native build / submit / OTA:** producing installable binaries, shipping them to TestFlight / Play internal track, and pushing JS-only OTA updates. Requires macOS build capacity, signing credentials, and store accounts.

Layer A is unblocked today. Layer B requires accounts and credentials (see [Required Secrets & Accounts](#required-secrets--accounts)).

---

## Options Evaluated

1. **EAS Build + EAS Submit + EAS Update** — Expo's managed cloud for native builds, store submission, and OTA. Handles macOS runners, signing, and certs. The native fit; this is the *engine* under several orchestration choices below.
2. **EAS Workflows** (`.eas/workflows/*.yml`) — Expo's own CI/CD orchestration layer on top of EAS. YAML pipelines triggered by GitHub pushes, mobile-optimized, with build caching.
3. **GitHub Actions orchestrating the EAS CLI** — keep all CI in GitHub Actions; run `eas build` / `eas submit` / `eas update` as steps. EAS still does the heavy lifting; GitHub owns triggers and secrets.
4. **GitHub Actions with self-hosted / local native builds** — [fastlane](https://fastlane.tools/) (the open-source Ruby toolchain for iOS/Android signing, building, and store upload — also what EAS uses internally) + native toolchains on self-hosted or GitHub macOS runners. Full control, highest setup and maintenance cost.
5. **PR-level checks only** — wire mobile lint + type-check + unit tests into GitHub Actions, independent of how native builds happen.

> Options 1–4 are **Layer B** strategies (with 1 being the engine for 2 and 3). Option 5 **is Layer A**. The recommendation combines **Option 5 (Layer A)** with **Option 1 driven by Option 3 (Layer B)**.

---

## Comparison Matrix

Layer B strategies compared across the ticket's dimensions. (EAS Build/Submit/Update is the engine for both "EAS Workflows" and "GitHub Actions + EAS CLI"; the difference is the orchestrator.)

| Dimension | EAS Workflows | **GitHub Actions + EAS CLI** ⭐ | Self-hosted / local native |
|---|---|---|---|
| **iOS build (macOS, signing, certs)** | EAS cloud macOS; managed credentials, auto-signing | Same (EAS cloud) — CLI just triggers it | You own macOS runners, Xcode upgrades, manual certs/provisioning |
| **Android build + signing (keystore)** | EAS cloud; EAS-managed keystore | Same (EAS cloud) | You manage keystore + JDK/SDK toolchain |
| **OTA updates** | `eas update` as a workflow job; channels per branch | `eas update` step in GH Actions; channels per branch | Roll your own (`expo export` + host bundles) or still call `eas update` |
| **Store submission** | `eas submit` job → TestFlight / Play internal | `eas submit` step → TestFlight / Play internal | fastlane (`pilot`/`supply`) — you maintain lanes |
| **Cost model** | EAS plan + EAS CI minutes for orchestration | EAS plan for builds; GH Linux minutes for orchestration (cheap) | GH macOS minutes ($0.062/min, ~10× Linux) or self-hosted upkeep |
| **Fit with existing GH Actions + Turbo** | Parallel CI system; duplicates triggers/secrets | **Native fit** — one control plane, reuses pnpm/turbo setup | Fits GH Actions but heavy; macOS runners alien to current Linux setup |
| **Setup effort** | Low–medium (learn EAS YAML) | **Low** (add EAS CLI steps to existing workflows) | High (runners, fastlane, signing, caching) |
| **Ongoing maintenance** | Low (Expo-managed) | **Low** (Expo-managed builds) | High (runner OS/Xcode/SDK upgrades, cert rotation) |
| **Secrets location** | Expo + GitHub (split) | **GitHub Secrets** (`EXPO_TOKEN` + store creds), single store | GitHub + runner-local keychains/keystores |
| **Lock-in / portability** | Higher (Expo-specific YAML) | Lower (thin CLI calls, swappable) | Lowest (you own everything) — at high cost |

**PR checks (Layer A)** is GitHub Actions on Linux for all strategies — there's no reason to spend macOS/EAS minutes on lint/type-check/JS tests.

---

## Recommended Approach

### Layer A — PR checks (GitHub Actions, Linux)

Add `mobile-tests.yml` mirroring `web-tests.yml`, `pull_request`-triggered with a `paths` filter on `apps/mobile/**` (+ shared packages it depends on: `packages/shared`, `packages/orpc-contracts`):

- `pnpm --filter mobile lint` → `expo lint`
- `pnpm --filter mobile check-types` → `tsc --noEmit`
- `pnpm --filter mobile build` → `expo export` (bundle smoke test: catches Metro/resolver breakage per platform)
- `pnpm --filter mobile test` → unit tests **once a runner is added** (`jest-expo` is the conventional choice for Expo). Until then this step is a no-op/placeholder.

> Type-check and Biome already run repo-wide via `lint.yml`; the value here is **scoping**, adding `expo lint`, and a home for mobile tests. Decide whether to keep relying on the unfiltered `lint.yml`/`build.yml` for mobile or move mobile fully into `mobile-tests.yml` — recommend the latter for clear ownership and faster, path-filtered feedback.

No Apple/Google/Expo accounts required for Layer A.

### Layer B — Native build / submit / OTA (EAS via GitHub Actions)

1. **Initialize EAS:** `eas init` (creates the Expo project, writes `projectId` + `owner` into `app.json`), add `eas.json` with `development` / `preview` / `production` build profiles.
2. **Builds:** GitHub Actions job runs `eas build --platform all --profile <profile> --non-interactive` authenticated with `EXPO_TOKEN`. EAS provisions macOS/Linux build workers and manages signing.
3. **Submission:** `eas submit --platform <p> --profile production` → TestFlight (iOS) and Play **internal** track (Android).
4. **OTA:** `eas update --branch <branch>` for JS-only changes. Map EAS Update **channels** to git branches: `develop` → `preview` channel, `main` → `production` channel (parallels the existing `deploy.yml` branch model). Set `runtimeVersion` policy so OTA only targets compatible native builds.
5. **Triggers:**
   - PR → Layer A checks only (no native build — too slow/costly per PR).
   - Merge to `develop` → `eas update` to `preview` (OTA) + optional internal build.
   - Merge to `main` / tagged release → `eas build` + `eas submit` to store tracks + `eas update` to `production`.

This keeps mobile's release model **parallel to the existing `deploy.yml`** (push-to-branch → environment) while delegating the native heavy lifting to EAS.

### E2E (Maestro) — runs through the same control plane

> **⚠️ CRITICAL CORRECTION (verified empirically 2026-06-30, GENESIS-171 implementation).** The EAS Workflows **`maestro` job requires a paid EAS plan** — it is **not** available on the Free tier. This contradicts the "start on Free" guidance below and was **missed by this spike** because the requirement is **undocumented**: it is enforced only at runtime, not stated on any Expo docs page (checked [pre-packaged jobs](https://docs.expo.dev/eas/workflows/pre-packaged-jobs/), [E2E example](https://docs.expo.dev/eas/workflows/examples/e2e-tests/), [Workflows intro](https://docs.expo.dev/eas/workflows/introduction/), [plans](https://docs.expo.dev/billing/plans/), [usage-based pricing](https://docs.expo.dev/billing/usage-based-pricing/)). On Free, a `type: maestro` job fails at validation (no build, no credits consumed) with:
>
> ```
> Running maestro_test jobs requires a paid plan. Subscribe to a paid plan:
> https://expo.dev/accounts/<account>/settings/billing or comment out the jobs from your workflow to continue.
> ```
>
> Notes: (1) EAS's error calls the job kind `maestro_test` internally — that string is *not* in our YAML (we use `type: maestro`); it's EAS's server-side name for the job kind. (2) The paid plan must be on the **account that owns the EAS project**, and the CI `EXPO_TOKEN` must be an identity (robot or personal token) **with access to that same account** — a token scoped to a different account/org fails earlier with `Entity not authorized … action = READ`. (3) The documented paid requirements for *other* things — the separate `maestro-cloud` job (Maestro Cloud subscription) and Maestro **insights** (Production/Enterprise) — are **not** the same as this `maestro` job gate. **Net: budget for EAS Starter ($19/mo) from day one if E2E runs in CI; the Free tier covers Layer A and EAS *builds*, but not the managed-device Maestro run.**

The E2E spike selected **Maestro**. E2E needs a built app on a real device (Android emulator + **iOS simulator, which is macOS-only**), so it can't run on the cheap Linux PR-check runners. It does **not**, however, require adopting EAS Workflows' git-push triggers or a separate macOS fleet: Maestro runs on EAS-managed devices and is callable via the **EAS CLI from GitHub Actions**, keeping GitHub Actions as the single control plane. Two paths, chosen by cadence:

| Cadence | Path | Mechanism |
|---|---|---|
| Nightly / per-merge | **Custom build** | `.eas/build/*.yml` with `eas/build` + `eas/maestro_test` steps (flows in `.maestro/`), referenced from an `eas.json` profile; GitHub Actions runs `eas build --profile e2e`. Each run is a build (no fingerprint reuse) — fine at low frequency. |
| Per-PR / frequent | **`eas workflow:run`** | Author `.eas/workflows/e2e.yml` (pre-packaged `maestro` job + fingerprint/`get-build`); GitHub Actions triggers it with `eas workflow:run` — any workflow runs regardless of its `on:` key. Fingerprint reuse skips the rebuild, the cost saver at volume. |

Self-managed macOS runners and Maestro Cloud are **not needed** — both CLI paths give managed iOS simulators with nothing to maintain. Start with the custom-build path at a per-merge/nightly cadence; switch to `eas workflow:run` only if E2E moves per-PR and the per-run rebuilds hurt. ~~The cost pressure point is the same Free-tier limit~~ **(corrected — see callout above):** the `maestro` job is paywalled entirely, so running E2E in CI requires a **paid plan from the start**, regardless of cadence; the Free-tier build/CI-minute limits are a secondary concern on top of that.

### Plan tier

Begin on **EAS Free** (15 iOS + 15 Android builds/month, 1 concurrency, 45-min timeout, EAS Update 1,000 MAU) **for Layer A + EAS *builds* only**. ⚠️ **Running the Maestro E2E job in CI requires a paid plan (Starter $19/mo minimum) from day one** — see the correction callout in the E2E section above; the Free tier cannot run `maestro` jobs at all. Beyond E2E, the other reasons to move to a paid plan (concurrency, the 2-hour timeout, higher EAS Update MAUs) remain launch-time concerns. See [Cost Appendix](#cost-appendix).

---

## Alternatives Considered (Beyond the Ticket)

The ticket's five options aren't the whole landscape. None of the below change the recommendation for an Expo app today, but they're the realistic escape hatches if EAS pricing, limits, or lock-in ever become a problem. (Two non-starters were ruled out and omitted: **Xcode Cloud** — iOS-only, no Android; and **Microsoft App Center** — retired 2025-03-31.)

### Managed alternatives to EAS

| Tool | What it is | Verdict for us |
|---|---|---|
| **[Codemagic](https://codemagic.io/)** | Managed mobile CI/CD, RN/Expo-aware; macOS builds, signing, store submit | Credible EAS competitor. For an *Expo* app, EAS still wins on depth (EAS Update OTA, fingerprint build reuse, native Expo config). Revisit only if EAS pricing/limits bite. |
| **[Bitrise](https://bitrise.io/)** | Mature managed mobile DevOps; the recommended App Center migration target | Same verdict as Codemagic — strong and proven, but redundant with EAS for Expo. The fallback if we ever leave EAS entirely. |

### Cost / control levers for native builds (if we self-host or outgrow EAS)

| Lever | What it is | When it matters |
|---|---|---|
| **`eas build --local`** | Runs the EAS build (using `eas.json`) on *your own* runner — no cloud build credits consumed | Clean path to move builds in-house later **without rewriting config**. Still needs a macOS runner for iOS. A graceful downgrade off EAS cloud. |
| **Cheaper macOS runner providers** — [Cirrus Runners](https://cirrus-runners.app/) (~$150/mo per concurrent slot, unlimited minutes), WarpBuild, Namespace, Blacksmith, RunsOn (in your own AWS), Ubicloud (~90% under GitHub) | Drop-in macOS runners for GitHub Actions | Only relevant **if** we self-host native builds (ticket option 4). They make that path far cheaper than GitHub's own macOS runners ($0.062/min), changing the cost calculus that otherwise rules self-hosting out. |

**Net:** for leaving EAS as a managed service → **Codemagic or Bitrise**. For keeping EAS config but reclaiming build compute → **`eas build --local`** on a **cheaper macOS runner**. We don't need any of these now, but documenting them means the door isn't bolted shut.

---

## Required Secrets & Accounts

| Secret / Account | Purpose | Where it lives | Cost |
|---|---|---|---|
| **Expo account + organization** | Owns the EAS project (`projectId`, `owner` in `app.json`) | Expo dashboard | Free tier to start |
| **`EXPO_TOKEN`** (robot/personal access token) | Authenticates EAS CLI in CI (build/submit/update) | GitHub Actions secret | — |
| **Apple Developer Program** | iOS signing, TestFlight, App Store | Apple | **$99/year** |
| **App Store Connect API key** (`.p8` + key id + issuer id) | Non-interactive `eas submit` to TestFlight | EAS credentials / GitHub secret | — |
| **iOS Distribution cert + provisioning profile** | iOS code signing | **EAS-managed** (recommended) or uploaded | — |
| **Google Play Console account** | Android publishing | Google | **$25 one-time** |
| **Play service account JSON** | Non-interactive `eas submit` to Play internal track | EAS credentials / GitHub secret | — |
| **Android upload keystore** | Android signing | **EAS-managed** (recommended) | — |

> Preference: let **EAS manage signing credentials** (certs/keystore) rather than hand-rolling them — it removes the most error-prone part of mobile CI/CD. Store account API keys (`EXPO_TOKEN`, App Store Connect key, Play JSON) as GitHub Actions secrets, consistent with how `deploy.yml` holds `RENDER_API_KEY` / `VERCEL_DEPLOY_HOOK`.

---

## Implementation Effort & Follow-up Ticket Outline

Rough effort for the chosen approach:

| Work | Effort | Notes |
|---|---|---|
| Layer A: `mobile-tests.yml` (lint/type-check/export) | **~0.5 day** | Copy `web-tests.yml` pattern; add path filters. |
| Layer A: add unit test runner (`jest-expo`) + first tests | **~1 day** | Separate, may belong with a testing-infra ticket. |
| Layer B: `eas init` + `eas.json` profiles | **~0.5 day** | Writes `projectId`/`owner`; define dev/preview/prod. |
| Layer B: Apple + Google account setup + credentials | **~1 day** (mostly waiting) | $99 Apple + $25 Google; account approval latency. |
| Layer B: GH Actions jobs (build/submit/update) + branch→channel wiring | **~1–1.5 days** | `EXPO_TOKEN`, triggers, channels, `runtimeVersion`. |
| First green end-to-end build + TestFlight/Play internal submit | **~0.5–1 day** | Iterating on signing is the usual time sink. |

**Total: ~4–5 working days** (plus external account approval latency), excludes writing the actual app test suite.

**Suggested follow-up tickets:**

- **GENESIS-XXX — Mobile PR checks (Layer A):** add `mobile-tests.yml` (lint, type-check, `expo export`); scope mobile out of the unfiltered `lint.yml`/`build.yml` if we want clean ownership. *No external accounts.*
- **GENESIS-XXX — Mobile test runner:** add `jest-expo` + a smoke test suite so the Layer A `test` step is real. (Coordinate with the E2E spike, which is separate.)
- **GENESIS-XXX — EAS bootstrap:** `eas init`, `eas.json`, Expo org, `EXPO_TOKEN`. Get one cloud build green (internal distribution, no store).
- **GENESIS-XXX — Store accounts & credentials:** Apple Developer + Play Console enrollment, App Store Connect API key, Play service account, EAS-managed signing.
- **GENESIS-XXX — Release automation (Layer B):** GH Actions build/submit/update jobs, branch→channel mapping (`develop`→preview, `main`→production), `runtimeVersion` policy.

---

## Cost Appendix

**EAS subscription plans** (expo.dev/pricing, 2026-06-17):

| Plan | Price | Build credit | Concurrency | Timeout | EAS Update MAU | Update bandwidth |
|---|---|---|---|---|---|---|
| **Free** | $0 | 15 iOS + 15 Android builds/mo | 1 | 45 min | 1,000 | 100 GiB |
| **Starter** | $19/mo + usage | $45/mo | 1 (+$50 each, max +5) | 2 hr | 3,000 | 100 GiB, then $0.10/GiB |
| **Production** | $199/mo + usage | $225/mo | 2 (+$50 each, max +5) | 2 hr | 50,000 | 1 TiB, then $0.10/GiB |
| **Enterprise** | Custom | from $1,000 | 5 (+$50 each) | 2 hr | 1M+ | 40 TiB |

- EAS Build is charged ~**$1–$4 per build** against the credit allowance (worker tier dependent), **not per-minute**.
- EAS Workflows / update jobs consume **CI minutes** (Free includes 100 update-job min/mo); per-minute rate varies by worker OS/spec.

**GitHub Actions runners** (2026 pricing):

- **Linux:** ~$0.008/min (baseline) — Layer A runs here; effectively free within plan allowances.
- **macOS:** **$0.062/min** (dropped from $0.080 on 2026-01-01), ~**10× Linux**, and consumes the plan's included-minute pool ~10× faster. **This is the cost we avoid by using EAS Build instead of GH macOS runners for native builds.**
- **Self-hosted runners:** remain **free** (the proposed $0.002/min charge was postponed indefinitely in Dec 2025) — but you pay in hardware + maintenance.

**Cost conclusion:** Pre-launch, **EAS Free + GitHub Linux** is effectively $0/month beyond the $99 Apple + $25 Google account fees. Native builds on EAS avoid the expensive GH macOS multiplier; self-hosting only wins at high, sustained build volume where its maintenance burden is justified.

---

## Out of Scope

- Building the actual pipeline (the follow-up tickets above).
- E2E test framework selection (separate spike).
- Changes to `apps/web` / `apps/server` CI.

---

## Sources

- [Expo Application Services Pricing](https://expo.dev/pricing)
- [Expo — Subscriptions, plans, and add-ons](https://docs.expo.dev/billing/plans/)
- [Expo — Usage-based pricing](https://docs.expo.dev/billing/usage-based-pricing/)
- [Expo — Get started with EAS Workflows](https://docs.expo.dev/eas/workflows/get-started/)
- [Expo EAS Update Pricing (React Native Stallion)](https://stalliontech.io/expo-eas-update-pricing)
- [Pricing changes for GitHub Actions (resources.github.com)](https://resources.github.com/actions/2026-pricing-changes-for-github-actions/)
- [Update to GitHub Actions pricing (GitHub Changelog, 2025-12-16)](https://github.blog/changelog/2025-12-16-coming-soon-simpler-pricing-and-a-better-experience-for-github-actions/)
- [GitHub self-hosted runner pricing change & alternatives (Northflank)](https://northflank.com/blog/github-pricing-change-self-hosted-alternatives-github-actions)
- [GitHub Actions Runner Showdown 2026 (Tenki)](https://tenki.cloud/blog/github-actions-runner-showdown-2026)
- [Comparing the top mobile CI/CD providers (Runway)](https://www.runway.team/blog/comparing-the-top-10-mobile-ci-cd-providers)
- [Best CI/CD tools for React Native (LogRocket)](https://blog.logrocket.com/best-ci-cd-tools-react-native/)
- [Visual Studio App Center retirement (Microsoft Learn)](https://learn.microsoft.com/en-us/appcenter/retirement)
- [Run E2E tests on EAS Workflows with Maestro](https://docs.expo.dev/eas/workflows/examples/e2e-tests/)
- [Automating EAS CLI commands — `eas workflow:run`](https://docs.expo.dev/eas/workflows/automating-eas-cli/)
- [EAS custom builds example — `build-and-maestro-test.yml`](https://github.com/expo/eas-custom-builds-example/blob/main/.eas/build/build-and-maestro-test.yml)
- [Custom build configuration schema](https://docs.expo.dev/custom-builds/schema/)

## Implemented Pipeline (bootstrap)

See `docs/engineering/mobile-cicd-pipeline-design.md` (design) and
`docs/engineering/mobile-cicd-pipeline-plan.md` (implementation plan).

> **Note — what shipped differs from the recommendation above on two points.** The sections above are the dated spike recommendation; the implemented Layer A drops the `expo lint` step (mobile is linted by **Biome** repo-wide per `apps/mobile/CLAUDE.md`, so an `expo lint` step would be redundant and scaffold an unwanted ESLint config) and ships **no `test` job** (the `jest-expo` unit runner is deferred to a separate ticket). The design doc is authoritative for what was built.

**One-time manual bootstrap (requires an Expo login):**

1. Create an Expo account + organization at https://expo.dev.
2. From `apps/mobile/`, run `eas init`. This writes `extra.eas.projectId`
   and `owner` into `apps/mobile/app.json`. Commit that change.
3. Generate a robot/personal access token (Expo dashboard → Account →
   Access tokens) and store it as the GitHub Actions secret `EXPO_TOKEN`.
4. Create a throwaway Clerk dev-instance test user. Store its credentials as:
   - GitHub Actions secrets `E2E_CLERK_USER_USERNAME`, `E2E_CLERK_USER_PASSWORD`
     (passed into the EAS workflow run).
   - EAS environment variables of the same names (Expo dashboard → project →
     Environment variables, `preview` environment) so the `maestro` job can
     read them.

Until step 2 is done, the E2E workflow is wired but will fail at
`eas workflow:run` with an auth/project error — this is expected.
