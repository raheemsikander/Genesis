# Setting Up Codecov

This document covers how to set up Codecov for code coverage reporting on pull requests.

> **Optional** — without `CODECOV_TOKEN`, coverage upload is silently skipped and PRs are not blocked. Tests still run and generate coverage reports locally regardless of Codecov setup. Follow the steps below only if you want PR coverage comments and delta tracking.

---

## Step 1 — Create a Codecov account

1. Go to [codecov.io](https://codecov.io) and sign up with GitHub
2. Grant Codecov access to your repository when prompted
3. Select the repository from the Codecov dashboard

---

## Step 2 — Add the repository token

1. In Codecov, go to your repository **Settings** and copy the **Repository Upload Token**
2. In GitHub, go to **Settings > Secrets and variables > Actions > New repository secret**
3. Name: `CODECOV_TOKEN`, Value: the **Repository Upload Token** you copied in the previous step

This token is used by the CI workflows to upload coverage reports after running tests.

---

## Step 3 — Create the bypass label

Create a `skip-coverage-check` label for exceptional PRs (large refactors, config-only changes) that should bypass the coverage delta check:

```bash
gh label create skip-coverage-check --description "Bypass coverage delta check" --color "FBCA04"
```

When this label is applied to a PR, coverage is not uploaded to Codecov and the status check is skipped.

---

## Step 4 — Verify

1. Open a PR against `develop`
2. Wait for the **Server Tests** and **Web Tests** workflows to complete
3. Confirm that Codecov posts a PR comment with coverage summary (total %, delta, per-file breakdown)
4. Confirm that `codecov/project` and `codecov/patch` status checks appear on the PR

The first PR establishes the baseline — the coverage delta check becomes meaningful from the second PR onward.

---

## How it works

### Coverage collection

Each test workflow runs Vitest with `--coverage`, generating lcov reports:

| Workflow | Flag | Report path |
|----------|------|-------------|
| Server Tests (unit) | `server-unit` | `apps/server/coverage/unit/lcov.info` |
| Server Tests (integration) | `server-integration` | `apps/server/coverage/integration/lcov.info` |
| Web Tests | `web` | `apps/web/coverage/lcov.info` |

### Codecov flags

Each workspace uploads coverage with a separate **flag**. This enables per-workspace tracking in the Codecov dashboard and PR comments. Flags use `carryforward: true`, so when only one workflow runs (e.g., server tests), the web coverage from the last run is preserved — preventing false "coverage decreased" signals.

### Coverage delta enforcement

Configured in `codecov.yml` at the repo root:

- **Project status**: Fails if overall coverage decreases (`target: auto`, `threshold: 0%`)
- **Patch status**: Reports coverage on new/changed code but does not enforce a minimum (`informational: true`)

### Bypassing the check

Apply the `skip-coverage-check` label to a PR. This skips the coverage upload step entirely, so the Codecov status checks do not run.

---

## Configuration

The Codecov configuration lives in `codecov.yml` at the repository root. Key settings:

| Setting | Value | Purpose |
|---------|-------|---------|
| `status.project.default.target` | `auto` | Compare against base commit coverage |
| `status.project.default.threshold` | `0%` | Fail if any decrease |
| `status.patch.default.informational` | `true` | Report only, no enforcement on new code |
| `flags.*.carryforward` | `true` | Preserve coverage from previous runs |
| `comment.layout` | `reach,diff,flags,files` | PR comment sections |

See the [Codecov documentation](https://docs.codecov.com/docs/codecov-yaml) for all available options.
