# Phase 3: CI/CD

**Goal:** All GitHub Actions checks passing on a pull request.

**Doc:** README → "CI / GitHub Actions" section for workflow overview. CLAUDE.md → "Git Workflow" section for branch naming and commit conventions.

---

## State Check

```bash
git remote -v               # Has a GitHub remote?
git branch --show-current   # On a feature branch?
ls .github/workflows/       # Workflows exist?
```

---

## Verification & Troubleshooting

### Before pushing: run CI checks locally

```bash
pnpm check-types     # TypeScript (matches lint.yml)
pnpm check           # Biome lint + format (matches lint.yml)
pnpm build           # Full monorepo build (matches build.yml)
pnpm test            # Server unit + integration + web unit (matches server-tests.yml + web-tests.yml)
```

Fix any failures locally before pushing. These are the same checks CI runs.

### Branch and commit conventions

Branch naming is enforced by a pre-push hook — see CLAUDE.md "Branch Naming" section for the pattern.

Commit messages are enforced by a commit-msg hook (commitlint) — see CLAUDE.md "Code Style" section for the format.

**Pre-commit hook fails (Biome):** `pnpm check` auto-fixes formatting, then re-stage and commit.

### After opening a PR

PR title must follow Conventional Commits — the `pr-title.yml` workflow validates this. See CLAUDE.md "PR Titles" section.

All 5 checks should appear within a minute. No repository secrets are needed — see the README CI section for details.

### CI-specific gotchas

**Build fails but works locally:** Check for uncommitted files the build depends on.

**Lint fails:** Run `pnpm check` locally, commit the auto-fixes.

**Server tests fail:** CI uses its own PostgreSQL service container. Tests shouldn't depend on local seed data or env-specific state.

---

## Phase 3 Complete

When all 5 PR checks are green.
