# Mobile CI/CD Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build mobile CI for `apps/mobile`: a path-filtered `mobile-tests.yml` (lint/type-check/bundle export) plus per-PR Maestro E2E on EAS-managed devices using fingerprint reuse, with deployment (store submit, OTA) deferred.

**Architecture:** GitHub Actions is the single control plane. Layer A runs correctness gates on cheap Linux runners and *owns* mobile checks (mobile is removed from the repo-wide `lint.yml`/`build.yml`). Layer B offloads native work to EAS: a GitHub Actions workflow triggers an EAS Workflow (`eas workflow:run`) that computes a fingerprint, reuses a matching build when native code is unchanged, otherwise builds, then runs Maestro on iOS simulator + Android.

**Tech Stack:** GitHub Actions, pnpm + Turbo, Expo SDK 56 / EAS CLI, EAS Workflows (`fingerprint`/`get-build`/`build`/`maestro` jobs), Maestro.

## Global Constraints

- Node 24 + pnpm; install with `pnpm install --frozen-lockfile` in CI (matches `web-tests.yml`).
- Workflows use `actions/checkout@v6`, `pnpm/action-setup@v6`, `actions/setup-node@v6` (`cache: pnpm`).
- Install new deps at the **workspace root**; respect `minimumReleaseAge: 10080` (7 days) and add install-script packages to `allowBuilds` in `pnpm-workspace.yaml`.
- Conventional Commits, scope required, lowercase, ≤100 chars. Allowed types: feat, fix, chore, refactor, docs, ci, build, test, perf, style, revert.
- Biome: tab indentation, double quotes. Run `pnpm check` before considering work done.
- Never refer to the platform as a "boilerplate" — it is a "platform".
- `env.ts` skips validation when `CI=true`, so `expo export` runs without real `EXPO_PUBLIC_*` values.
- E2E builds are **unsigned** (iOS simulator) / internal (Android APK) — no Apple/Google store accounts, no OTA. Deployment is out of scope.
- E2E PR check is **non-blocking** (informational) on day one — do not mark it a required status check.
- Maestro flows already exist at `apps/mobile/e2e/flows/**`; `apps/mobile/e2e/run.ts` is the local-dev wrapper and stays local-only.

---

## File Structure

- `.github/workflows/mobile-tests.yml` — **create**. Layer A PR checks (lint, type-check, bundle export), path-filtered.
- `.github/workflows/lint.yml` — **modify**. Scope mobile out of repo-wide `check-types`.
- `.github/workflows/build.yml` — **modify**. Scope mobile out of repo-wide `build`.
- `apps/mobile/eas.json` — **create**. Single `e2e` build profile (iOS simulator + Android APK, no credentials).
- `apps/mobile/app.json` — **modify**. Add EAS `projectId` + `owner` + `extra.eas` (written by `eas init`; documented here for the manual bootstrap step).
- `apps/mobile/.eas/workflows/e2e.yml` — **create**. EAS Workflow: fingerprint → get-build → conditional build → maestro, per platform.
- `.github/workflows/mobile-e2e.yml` — **create**. GitHub Actions: per-PR, path-filtered, triggers the EAS workflow via `eas workflow:run`.
- `docs/setup/integrations/RUNNING_TESTS.md` — **modify**. Add "Mobile E2E in CI" section.
- `docs/engineering/mobile-cicd-pipeline-options.md` — **modify**. Add an "Implemented pipeline" pointer to this plan + the design doc.

---

### Task 1: Layer A — `mobile-tests.yml` PR checks

**Files:**
- Create: `.github/workflows/mobile-tests.yml`

**Interfaces:**
- Consumes: existing mobile package scripts `check-types` (`tsc --noEmit`) and `build` (`expo export --platform ios --platform android`). No lint step — mobile is linted by Biome repo-wide (see note below).
- Produces: a `pull_request` workflow named "Mobile Tests" gating mobile on Linux.

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/mobile-tests.yml`:

```yaml
name: Mobile Tests

on:
  pull_request:
    paths:
      - "apps/mobile/**"
      - "packages/shared/**"
      - "packages/orpc-contracts/**"
      - "pnpm-lock.yaml"
      - ".github/workflows/mobile-tests.yml"

jobs:
  checks:
    name: Mobile PR Checks
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Type-check
        run: pnpm --filter mobile check-types

      - name: Bundle smoke test (expo export)
        run: pnpm --filter mobile build
```

> No lint step: mobile is linted by Biome (per `apps/mobile/CLAUDE.md`, "Biome, not the Expo lint defaults"), which runs repo-wide in `lint.yml` and already covers `apps/mobile`. An `expo lint` step would scaffold an unwanted ESLint config + deps and duplicate Biome.

- [ ] **Step 2: Validate the workflow YAML locally**

Run: `pnpm dlx @action-validator/cli .github/workflows/mobile-tests.yml`
Expected: exits 0 (no schema errors). If `@action-validator/cli` is unavailable offline, instead run `node -e "require('js-yaml')" 2>/dev/null || npx --yes yaml@2 -e ".github/workflows/mobile-tests.yml"` to confirm the YAML parses. At minimum, confirm `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/mobile-tests.yml'))"` prints nothing and exits 0.

- [ ] **Step 3: Verify the referenced scripts exist and run**

Run: `pnpm --filter mobile check-types`
Expected: PASS (exits 0) — confirms the script name is correct and mobile type-checks today.

(No lint command to verify — lint is Biome's job, run repo-wide in `lint.yml`.)

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/mobile-tests.yml
git commit -m "ci(genesis-171): add mobile-tests workflow for PR checks"
```

---

### Task 2: Scope mobile out of repo-wide `lint.yml` and `build.yml`

**Files:**
- Modify: `.github/workflows/lint.yml`
- Modify: `.github/workflows/build.yml`

**Interfaces:**
- Consumes: Turbo `--filter` exclusion syntax (`'!mobile'`).
- Produces: `lint.yml`/`build.yml` no longer run mobile; `mobile-tests.yml` (Task 1) is the sole mobile gate.

**Context:** `pnpm check-types` is `turbo check-types`; `pnpm build` is `turbo build`. Both run all workspaces unfiltered today. Excluding mobile keeps non-mobile PRs from running mobile work. Biome (`pnpm biome check .`) stays repo-wide — it is fast and global; only the turbo tasks are scoped.

- [ ] **Step 1: Scope `check-types` in `lint.yml`**

In `.github/workflows/lint.yml`, replace the line:

```yaml
      - run: pnpm check-types
```

with:

```yaml
      - run: pnpm turbo check-types --filter='!mobile'
```

- [ ] **Step 2: Scope `build` in `build.yml`**

In `.github/workflows/build.yml`, replace the line:

```yaml
      - run: pnpm build
```

with:

```yaml
      - run: pnpm turbo build --filter='!mobile'
```

- [ ] **Step 3: Verify the exclusion filter resolves mobile out**

Run: `pnpm turbo build --filter='!mobile' --dry-run=json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const tasks=JSON.parse(s).tasks.map(t=>t.package);console.log('mobile included:', tasks.includes('mobile'))})"`
Expected: prints `mobile included: false`.

Run: `pnpm turbo check-types --filter='!mobile' --dry-run=json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const tasks=JSON.parse(s).tasks.map(t=>t.package);console.log('mobile included:', tasks.includes('mobile'))})"`
Expected: prints `mobile included: false`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/lint.yml .github/workflows/build.yml
git commit -m "ci(genesis-171): scope mobile out of repo-wide lint and build"
```

---

### Task 3: EAS `e2e` build profile

**Files:**
- Create: `apps/mobile/eas.json`

**Interfaces:**
- Produces: an `e2e` build profile referenced by `apps/mobile/.eas/workflows/e2e.yml` (Task 5) via `profile: e2e`.

**Context:** `withoutCredentials: true` + `ios.simulator: true` produce an unsigned iOS simulator build (no Apple account); `android.buildType: apk` produces an installable APK for the Maestro emulator. `cli.appVersionSource` is set to `remote` to match EAS defaults and avoid an interactive prompt.

- [ ] **Step 1: Create `apps/mobile/eas.json`**

```json
{
	"cli": {
		"version": ">= 12.0.0",
		"appVersionSource": "remote"
	},
	"build": {
		"e2e": {
			"withoutCredentials": true,
			"ios": {
				"simulator": true
			},
			"android": {
				"buildType": "apk"
			}
		}
	}
}
```

- [ ] **Step 2: Validate JSON parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('apps/mobile/eas.json','utf8')); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Format with Biome**

Run: `pnpm biome check --write apps/mobile/eas.json`
Expected: exits 0; file is tab-indented.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/eas.json
git commit -m "build(genesis-171): add eas e2e build profile (ios sim + android apk)"
```

---

### Task 4: Document EAS bootstrap prerequisites (manual)

**Files:**
- Modify: `docs/engineering/mobile-cicd-pipeline-options.md`

**Interfaces:**
- Consumes: nothing in code.
- Produces: a written, repeatable bootstrap checklist; defines the GitHub/EAS secret names used by Tasks 5–6 (`EXPO_TOKEN`, `E2E_CLERK_USER_USERNAME`, `E2E_CLERK_USER_PASSWORD`).

**Context:** `eas init` (run by a human with Expo login) writes `extra.eas.projectId` and `owner` into `apps/mobile/app.json`. The plan cannot run `eas init` non-interactively without an account, so this task documents it precisely so the human step is unambiguous and the workflow YAML (Tasks 5–6) is correct before the account exists.

- [ ] **Step 1: Append an "Implemented pipeline — bootstrap" section**

Add to the end of `docs/engineering/mobile-cicd-pipeline-options.md`:

```markdown
## Implemented Pipeline (bootstrap)

See `docs/engineering/mobile-cicd-pipeline-design.md` (design) and
`docs/engineering/mobile-cicd-pipeline-plan.md` (implementation plan).

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
```

- [ ] **Step 2: Verify the file still renders (no broken markdown)**

Run: `node -e "const t=require('fs').readFileSync('docs/engineering/mobile-cicd-pipeline-options.md','utf8'); console.log('lines:', t.split('\n').length)"`
Expected: prints a line count (file readable).

- [ ] **Step 3: Commit**

```bash
git add docs/engineering/mobile-cicd-pipeline-options.md
git commit -m "docs(genesis-171): document EAS bootstrap prerequisites"
```

---

### Task 5: EAS Workflow — fingerprint reuse + Maestro (`apps/mobile/.eas/workflows/e2e.yml`)

> **⛔ SUPERSEDED — do NOT implement the YAML in this task verbatim.** The `get-build` + `if: build_id == null` + `if: !failure()` graph below was **abandoned**: on EAS, a skipped `build` dependency auto-skips `maestro` regardless of the `if`, producing a silent **false-green** (tests never run), and a reused binary carries stale JS/env. The **shipped** `apps/mobile/.eas/workflows/e2e.yml` is the simpler **always-build** form (every run builds fresh; `maestro` needs only `build`). The fingerprint-reuse approach is being revisited separately via Expo's **`repack` + `after:`** pattern (see the "IMPLEMENTATION UPDATE" callout in `mobile-cicd-pipeline-design.md`). The build profile (Task 3), `preview` env wiring, and bootstrap (Task 4) still apply. The YAML below is retained only as historical context.

**Files:**
- Create: `apps/mobile/.eas/workflows/e2e.yml`

**Interfaces:**
- Consumes: the `e2e` build profile from Task 3 (`profile: e2e`); EAS env vars `E2E_CLERK_USER_USERNAME`/`E2E_CLERK_USER_PASSWORD` (from Task 4 bootstrap) via the `preview` environment.
- Produces: an EAS Workflow named `e2e` invoked by `eas workflow:run e2e.yml` (Task 6). Job graph per platform: `fingerprint` → `get-build` (by fingerprint hash) → conditional `build` (only if no matching build) → `maestro` against whichever build_id is present.

**Context:** EAS `build` jobs do NOT auto-reuse by fingerprint — reuse is wired manually with a `fingerprint` job feeding `get-build`, then a `build` job gated on `get-build` returning no `build_id`. The `maestro` job's `build_id` must select the reused build when present, else the fresh one. `flow_path` points at the existing flows. The `environment: preview` on the maestro job exposes the Clerk EAS env vars to the flows.

- [ ] **Step 1: Create `apps/mobile/.eas/workflows/e2e.yml`**

```yaml
name: e2e

on:
  workflow_dispatch: {}
  push:
    branches: ['__never__']

jobs:
  fingerprint:
    type: fingerprint
    environment: preview

  get_build_ios:
    needs: [fingerprint]
    type: get-build
    params:
      platform: ios
      profile: e2e
      simulator: true
      fingerprint_hash: ${{ needs.fingerprint.outputs.ios_fingerprint_hash }}

  build_ios:
    needs: [get_build_ios]
    if: ${{ needs.get_build_ios.outputs.build_id == null }}
    type: build
    params:
      platform: ios
      profile: e2e

  maestro_ios:
    needs: [get_build_ios, build_ios]
    type: maestro
    environment: preview
    if: ${{ !failure() }}
    params:
      build_id: ${{ needs.get_build_ios.outputs.build_id || needs.build_ios.outputs.build_id }}
      flow_path: ['e2e']

  get_build_android:
    needs: [fingerprint]
    type: get-build
    params:
      platform: android
      profile: e2e
      fingerprint_hash: ${{ needs.fingerprint.outputs.android_fingerprint_hash }}

  build_android:
    needs: [get_build_android]
    if: ${{ needs.get_build_android.outputs.build_id == null }}
    type: build
    params:
      platform: android
      profile: e2e

  maestro_android:
    needs: [get_build_android, build_android]
    type: maestro
    environment: preview
    if: ${{ !failure() }}
    params:
      build_id: ${{ needs.get_build_android.outputs.build_id || needs.build_android.outputs.build_id }}
      flow_path: ['e2e']
```

> The `push.branches: ['__never__']` placeholder keeps EAS from auto-triggering on git pushes — GitHub Actions (Task 6) is the only trigger, via `eas workflow:run`. `workflow_dispatch` allows manual runs from the EAS dashboard. (Per the spike doc: "any workflow runs regardless of its `on:` key" when invoked via `eas workflow:run`.)

- [ ] **Step 2: Validate YAML parses**

Run: `python3 -c "import yaml; yaml.safe_load(open('apps/mobile/.eas/workflows/e2e.yml')); print('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Confirm flow path exists**

Run: `ls apps/mobile/e2e/flows/smoke/app-launch.yaml`
Expected: the path prints (flows dir is real, so `flow_path` resolves).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/.eas/workflows/e2e.yml
git commit -m "ci(genesis-171): add eas e2e workflow with fingerprint reuse + maestro"
```

---

### Task 6: GitHub Actions trigger — `mobile-e2e.yml` (per-PR, non-blocking)

**Files:**
- Create: `.github/workflows/mobile-e2e.yml`

**Interfaces:**
- Consumes: `EXPO_TOKEN` secret; the EAS workflow `e2e` (Task 5) via `eas workflow:run e2e.yml`.
- Produces: a per-PR, path-filtered GitHub Actions check named "Mobile E2E" that delegates to EAS. Non-blocking by virtue of NOT being added to branch-protection required checks.

**Context:** This is the single control-plane trigger. It runs on PRs touching mobile, authenticates the EAS CLI with `EXPO_TOKEN`, and calls `eas workflow:run`. `--non-interactive` prevents prompts. The job does not need full `pnpm install` — only the EAS CLI — but checkout is required so `eas` finds `apps/mobile` + `.eas/workflows`.

- [ ] **Step 1: Create `.github/workflows/mobile-e2e.yml`**

```yaml
name: Mobile E2E

on:
  pull_request:
    paths:
      - "apps/mobile/**"
      - "packages/shared/**"
      - "packages/orpc-contracts/**"
      - "apps/mobile/.eas/workflows/e2e.yml"
      - ".github/workflows/mobile-e2e.yml"

jobs:
  e2e:
    name: Maestro E2E (EAS)
    runs-on: ubuntu-latest
    # Non-blocking on day one: do NOT add this job to branch-protection
    # required checks until the E2E suite is proven stable.
    env:
      EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
    steps:
      - uses: actions/checkout@v6

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: pnpm

      - name: Guard — skip when EXPO_TOKEN is absent
        id: guard
        run: |
          if [[ -z "$EXPO_TOKEN" ]]; then
            echo "EXPO_TOKEN not set — skipping EAS E2E (bootstrap pending)."
            echo "run=false" >> "$GITHUB_OUTPUT"
          else
            echo "run=true" >> "$GITHUB_OUTPUT"
          fi

      - name: Trigger EAS E2E workflow
        if: ${{ steps.guard.outputs.run == 'true' }}
        run: pnpm dlx eas-cli@latest workflow:run e2e.yml --non-interactive
        working-directory: apps/mobile
```

> The guard step makes the job a no-op (green) until `EXPO_TOKEN` is configured, so the workflow can merge before the EAS account exists without producing red checks. `working-directory: apps/mobile` ensures the EAS CLI resolves the Expo project (where `eas.json`/`app.json` live); EAS looks for the workflow in that project's `.eas/workflows/` dir, so the run arg is the bare filename `e2e.yml`.

- [ ] **Step 2: Validate YAML parses**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/mobile-e2e.yml')); print('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Confirm the guard logic is shell-valid**

Run: `bash -n <(printf '%s\n' 'if [[ -z "$EXPO_TOKEN" ]]; then echo a; else echo b; fi')`
Expected: exits 0 (no syntax error).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/mobile-e2e.yml
git commit -m "ci(genesis-171): add per-PR mobile e2e trigger (non-blocking)"
```

---

### Task 7: Document Mobile E2E in CI

**Files:**
- Modify: `docs/setup/integrations/RUNNING_TESTS.md`

**Interfaces:**
- Consumes: nothing in code.
- Produces: a "Mobile E2E in CI" section explaining the per-PR flow, non-blocking status, and cost/concurrency notes.

- [ ] **Step 1: Append the CI section**

Add to `docs/setup/integrations/RUNNING_TESTS.md` (after the existing Mobile E2E local section):

```markdown
### Mobile E2E in CI

Maestro E2E runs on **every PR touching `apps/mobile/**`** (or the shared
packages it depends on), driven by `.github/workflows/mobile-e2e.yml`. GitHub
Actions triggers an EAS Workflow (`apps/mobile/.eas/workflows/e2e.yml`) via
`eas workflow:run`; EAS computes a **fingerprint** and **reuses** a prior build
when native code is unchanged (the common, JS-only case), otherwise builds an
unsigned iOS-simulator + Android-APK binary, then runs the flows in
`apps/mobile/e2e/flows/**` on managed devices.

- **Status:** non-blocking (informational) until the suite is proven stable.
  It is intentionally not a required check.
- **Bootstrap:** requires `EXPO_TOKEN` and the Clerk E2E env vars — see the
  "Implemented Pipeline (bootstrap)" section of
  `docs/engineering/mobile-cicd-pipeline-options.md`. Until `EXPO_TOKEN` is set,
  the CI job is a green no-op.
- **Cost/concurrency:** EAS Free tier = 1 build concurrency, so concurrent PRs
  queue. Steady per-PR volume likely needs EAS Starter (~$19/mo) once free CI
  minutes are exhausted. No Apple/Google store accounts are required (simulator
  / internal builds only).
- **Deployment (store submit, OTA) is not part of this pipeline** — deferred.
```

- [ ] **Step 2: Verify file readable**

Run: `node -e "console.log('lines:', require('fs').readFileSync('docs/setup/integrations/RUNNING_TESTS.md','utf8').split('\n').length)"`
Expected: prints a line count.

- [ ] **Step 3: Commit**

```bash
git add docs/setup/integrations/RUNNING_TESTS.md
git commit -m "docs(genesis-171): document mobile e2e in CI"
```

---

### Task 8: Update CLAUDE.md CI table

**Files:**
- Modify: `CLAUDE.md` (the "CI Requirements" table under Git Workflow)

**Interfaces:**
- Produces: documentation parity — the CI table lists the new workflows.

- [ ] **Step 1: Add rows to the CI Requirements table**

In `CLAUDE.md`, in the `| Workflow | What it checks |` table, add:

```markdown
| `mobile-tests.yml` | Mobile lint + type-check + bundle export (path-filtered to `apps/mobile`) |
| `mobile-e2e.yml` | Maestro E2E on EAS (per-PR, **non-blocking**) — see `docs/engineering/mobile-cicd-pipeline-design.md` |
```

- [ ] **Step 2: Verify the table still parses (row count sanity)**

Run: `grep -c '^| ' CLAUDE.md`
Expected: prints a count greater than before (rows added).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(genesis-171): list mobile workflows in CI requirements table"
```

---

## Self-Review

**Spec coverage:**
- Layer A `mobile-tests.yml` (lint/type-check/export) → Task 1. ✓
- Scope mobile out of `lint.yml`/`build.yml` → Task 2. ✓
- Minimal EAS bootstrap (`eas.json` e2e profile, `projectId`/`owner`, `EXPO_TOKEN`) → Tasks 3 (profile) + 4 (manual bootstrap doc, projectId/owner, secrets). ✓
- `apps/mobile/.eas/workflows/e2e.yml` with fingerprint reuse + maestro → Task 5. ✓
- `mobile-e2e.yml` per-PR, path-filtered, non-blocking → Task 6. ✓
- Clerk E2E creds as EAS secrets → Task 4 (bootstrap) + consumed in Task 5 (`environment: preview`). ✓
- Docs: RUNNING_TESTS CI section → Task 7; pipeline overview pointer → Task 4; CI table → Task 8. ✓
- Out of scope (jest-expo, store submit, OTA) → not present in any task. ✓
- Non-blocking policy → encoded in Task 6 (guard + comment, not a required check) and documented in Tasks 7–8. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases". The `'__never__'` branch in Task 5 and `working-directory` in Task 6 are intentional, explained inline. `eas init` is a documented human step (Task 4), not a code placeholder.

**Type/name consistency:** Build profile is `e2e` in Task 3 and referenced as `profile: e2e` in Task 5. Secret names `EXPO_TOKEN`, `E2E_CLERK_USER_USERNAME`, `E2E_CLERK_USER_PASSWORD` consistent across Tasks 4–6. Workflow file `apps/mobile/.eas/workflows/e2e.yml` referenced identically in Tasks 5–7. Maestro `flow_path` is `e2e/flows` (project-root-relative to apps/mobile, the real dir) in Task 5.

**Known runtime caveat (flagged, not a plan defect):** EAS Workflow job-graph behavior (`if: build_id == null`, the `a || b` build_id selection, exact `get-build` output names) is verified against current Expo docs but can only be fully validated once `EXPO_TOKEN` + an Expo project exist. The Task 6 guard makes CI green until then; first real run (post-bootstrap) is the verification point for the EAS YAML semantics.

**Skip-propagation guard (added during execution):** the `maestro_*` jobs carry `if: ${{ !failure() }}`. Without it, a maestro job that `needs:` a `build_*` job would be skipped whenever that build is skipped — i.e. on the fingerprint-reuse path (the common case) — silently not running E2E. `!failure()` runs maestro when no dependency failed (build success OR skipped/reused) and skips it only when get-build/build actually fails. EAS Workflows exposes `needs.<job>.status` and `failure()` (no `always()`), per its syntax docs.
