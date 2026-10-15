# Branching and Releases

**Branch off `develop`, always.** `develop` is the default branch and permanently runs ahead of `main`. `main` only moves when you cut a release, so a growing gap between the two is the expected steady state, not drift that needs fixing.

Two things need care, and they are the reason this document exists:

1. In a repo created from the Genesis template with **Include all branches**, `develop` and `main` start with **unrelated histories**. The first `develop → main` merge fails until you give them a common ancestor. Do this once, early.
2. A release merge must land as a **merge commit**. Squashing a release PR puts a commit on `main` that shares no history with `develop`, which makes every later release conflict on the same files all over again.

The day-to-day branch model, naming rules, and hotfix diagram live in [Git Workflow](../../CLAUDE.md#git-workflow). This document covers what that section does not: the divergence and the release merge itself.

## Which branch do I start from?

| Situation | Base branch |
|-----------|-------------|
| Starting a new product from the Genesis template | `develop` (see [Step 0](../../README.md#step-0--start-a-new-product-from-this-template)) |
| Any feature, fix, or chore | `develop` |
| Urgent production fix that cannot wait for the next release | `main`, as `hotfix/*` |

`main` is never a base for regular work, and nothing is ever committed to it directly. Only release merges and hotfix PRs land there.

## Why `develop` runs ahead of `main`

`develop` takes every approved PR and deploys to staging. `main` takes a merge only when you release, and deploys to production. During MVP only staging is deployed, so `main` can sit untouched for weeks while `develop` absorbs dozens of PRs.

That is by design. The gap is a measure of unreleased work, not a problem:

```bash
git fetch origin
git rev-list --left-right --count origin/main...origin/develop
# → "<commits only on main>  <commits only on develop>"
```

The right number is the unreleased work. The left number counts what `main` has and `develop` does not, and it is normally about one per past release: each release lands as a merge commit that exists only on `main`. A left number well above your release count usually means a hotfix landed on `main` and was never merged back, which is what turns the next release merge into a conflict-heavy one. See [After a hotfix](#after-a-hotfix-merge-main-back-into-develop).

## One-time setup: give `main` and `develop` a common ancestor

A repo created from the template with **Include all branches** inherits both branches with no shared commit. The first release merge then fails:

```
fatal: refusing to merge unrelated histories
```

Fix it once, on a clean tree, right after creating the repo and well before your first release: merge `develop` into `main` with `git merge develop --allow-unrelated-histories`, resolve the trivial overlaps on shared files (README, configs), and land the result on `main`. The full procedure, including the case where `main` does not exist at all, is in the [`main`-branch prerequisite](../setup/manual/PROD_ENV.md#prerequisite--main-branch). That guide is labelled legacy because Terraform replaced the rest of it, but this prerequisite still applies to every template-derived repo.

Two things about the timing:

- Do it **before** `pnpm configure-repo` (see [Local development](../setup/LOCAL_ENV.md)), which applies a `main` ruleset requiring one approving review and forbidding non-fast-forward pushes. After that ruleset exists, the direct `git push origin main` in the linked procedure is rejected and you have to land the merge through a PR instead.
- If you have already configured the repo, open the merge as a PR into `main` rather than pushing directly. `main` is never committed to directly.

After this, `main` and `develop` share history and every later release merge is an ordinary merge with no flags.

## Releasing: `develop` → `main`

1. Confirm `develop` is green on CI and staging looks healthy. `main` inherits whatever `develop` has.
2. Open a PR from `develop` into `main`. The title is validated by `pr-title.yml` against Conventional Commits, and `release` is **not** an allowed type. Use `chore`, for example `chore(release): v1.4.0`.
3. Merge it with a **merge commit**. This is enforced, not just convention: `pnpm configure-repo` restricts `main` to merge commits (and `develop` to squash merges), and rebase merging is disabled repo-wide.
4. Merging triggers `deploy.yml` against the production environment. Separately, the PR-close event runs `issue-lifecycle.yml`, which comments on, re-labels `released`, and closes every `ready-to-release` issue.

Squashing is the trap worth repeating: it collapses the release into a single new commit whose parent chain does not include any of `develop`'s commits, so Git sees the same file changes as unrelated work again at the next release. One squashed release PR is enough to reintroduce the divergence the one-time merge above was meant to end.

## When the release merge conflicts

Conflicts in a `develop → main` merge almost always mean `main` carries a change `develop` never received. Resolve on a throwaway branch rather than in the PR's web editor, so you can inspect and test the result:

```bash
git fetch origin
git switch -c release/main origin/main
git merge origin/develop
# resolve: for anything that is simply newer work, keep develop's side
git push -u origin release/main
```

Then open `release/main → main` and merge that instead. The `release/` prefix matters: `release/*` and `hotfix/*` are exempt from the pre-push branch-name check, while a name like `release-main` is not and the push is rejected.

Never resolve a release conflict by rebasing `develop` onto `main`. That rewrites history other people have already pulled, and `develop` is the default branch everyone works from.

## After a hotfix: merge `main` back into `develop`

A hotfix lands on `main` first, which leaves `main` ahead in one direction. Close the loop immediately:

```bash
git fetch origin
git switch -c hotfix/sync-main origin/develop
git merge origin/main
git push -u origin hotfix/sync-main
```

Then open `hotfix/sync-main → develop`. One wrinkle: `develop`'s ruleset allows only squash merges, and a squashed sync does not make `main`'s commits ancestors of `develop`, so the same hotfix will conflict again at the next release. To land it as a real merge, either temporarily add `merge` to `develop`'s allowed merge methods, or have someone with bypass permission push the merge commit to `develop` directly.

Skipping the sync altogether is the single biggest reason release merges grow large and conflict-prone: the unreturned hotfix conflicts with every later change to the same files, and it does so again at every release until it is merged back.

## Quick reference

| Action | Command or rule |
|--------|-----------------|
| Measure the gap | `git rev-list --left-right --count origin/main...origin/develop` (right = unreleased work) |
| First release ever, unrelated histories | `git merge develop --allow-unrelated-histories`, once, before `pnpm configure-repo` |
| Release PR title | `chore(release): <version>` (no `release` type exists) |
| Release merge strategy | Merge commit only, never squash, never rebase |
| Release merge conflicts | Resolve on a `release/main` branch, keep `develop`'s side for newer work |
| After every hotfix | Merge `main` into `develop` the same day, as a merge commit, not a squash |
