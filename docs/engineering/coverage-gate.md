# Code Coverage Gate

## Summary (BLUF)

Coverage is compulsory and may never regress. Two independent layers enforce it: pinned Vitest thresholds (a hard floor that works in every fork, with no external service) and Codecov status checks (relative non-regression against the base commit, plus a fixed 80% bar on changed lines). **Ratchet the thresholds up, never down.** When coverage improves, raise the numbers in the same PR.

## Layer 1: Vitest thresholds (hard floor, fork-proof)

`coverage.thresholds` in `apps/server/vitest.unit.config.ts` and `apps/web/vitest.config.ts` fail the test run when coverage drops below the pinned baseline. This needs no external service or token, so it holds in every fork.

Current floors:

| Suite | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| Server unit | 41 | 53 | 30 | 41 |
| Web | 23 | 19 | 15 | 22 |

These were reset in GENESIS-191 when honest `coverage.include` was added. The denominator expanded to all of `src/` (previously the V8 provider counted only files a test imported), so the percentages dropped while the set of covered lines was unchanged. That was a measurement fix, not a coverage regression.

Ratchet up, never down, from this reset baseline: when coverage improves, raise these numbers in the same PR; never lower them.

The integration suite has no standalone threshold. It targets controller and DB paths, so its isolated number is not a meaningful whole-app gate. It still runs with `--coverage` so its data feeds Codecov.

## Layer 2: Codecov (relative non-regression, when `CODECOV_TOKEN` is set)

`codecov.yml` `status.project: target: auto` blocks any drop versus the base commit beyond a 0.5% jitter buffer (v8 line counting is not perfectly deterministic run-to-run). `status.patch: target: 80%` holds new and changed lines in a PR to a fixed 80% bar.

Patch is pinned rather than `auto` on purpose. `auto` grades new code against the overall project number, which the GENESIS-191 baseline reset collapsed to roughly 34/19% (see the table above for where the floors sit today), so `auto` would let a large untested module through. A fixed target keeps new code to a standard independent of the legacy baseline while the project floor ratchets up.

Make these required status checks in branch protection for hard enforcement.

## Local enforcement: the `pre-push` hook

The `pre-push` hook validates the branch name first (cheap, always runs). `main`/`develop` and `dependabot/*`, `release/*`, `hotfix/*` branches skip the name check but still run tests. It then runs the threshold-gated server-unit and web suites locally (integration is skipped because it needs the test DB).

For WIP pushes, `SKIP_COVERAGE=1 git push` runs the same suites without the coverage threshold gate. Tests still run and must pass; only the threshold check is skipped. The branch-name check is never skipped, and CI plus Codecov remain the hard floor. Bypass the whole hook with `git push --no-verify`.
