# Setting Up Repository Security

This document covers how to set up dependency security scanning for the GitHub repository.

> **Optional** — the app runs fully without it, but recommended for any repo that ships to production.

The repo includes config files for two tools:
- **Dependabot** — automated dependency update PRs + vulnerability alerts (built into GitHub)
- **Socket.dev** — PR-level supply chain analysis (GitHub App)

These are GitHub-level settings that must be configured once per repo — they are not part of the local dev setup.

---

## Step 1 — Enable Dependabot

The config file `.github/dependabot.yml` is already in the repo and activates automatically when pushed to the default branch. Verify it's working:

1. Go to **GitHub repo → Settings → Code security**
2. Under **Dependabot**, ensure both are enabled:
   - **Dependabot alerts** — notifies about known vulnerabilities in dependencies
   - **Dependabot version updates** — creates PRs to keep dependencies current (configured in `.github/dependabot.yml`)

If "Dependabot version updates" shows as disabled, click **Enable** — the config file will be picked up automatically.

### What Dependabot does

- Creates weekly PRs (every Monday) to update dependencies across the monorepo
- Groups minor/patch updates into fewer PRs to reduce noise
- Major version updates come as individual PRs for manual review
- Also keeps GitHub Actions versions current (e.g., `actions/checkout`, `actions/setup-node`)
- Targets the `develop` branch

### Configuration

The config lives at `.github/dependabot.yml`. To change the schedule, grouping, or PR limits, edit that file directly. See [GitHub's Dependabot docs](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file) for all options.

---

## Step 2 — Install Socket.dev

Socket.dev is a GitHub App that must be installed on the repository. The config file `socket.yml` in the repo root customizes its behavior, but the app must be installed first.

1. Go to [github.com/apps/socket-security](https://github.com/apps/socket-security)
2. Click **Install**
3. Select your organization
4. Choose **Only select repositories** → select this repo
5. Confirm installation

Socket starts working immediately — no secrets or env vars needed.

### What Socket does

When a PR adds or updates a dependency, Socket analyzes the package's actual behavior and comments on the PR if it detects risks:

- **Typosquatting** — package names similar to popular packages
- **Install scripts** — packages that execute code during `pnpm install`
- **Network access** — packages that make HTTP requests
- **Shell access** — packages that spawn child processes
- **Filesystem access** — packages that read/write files outside expected paths
- **Obfuscated code** — minified or deliberately obscured source
- **Environment variable access** — packages reading sensitive env vars

### Configuration

The config lives at `socket.yml` in the repo root. See [Socket's docs](https://docs.socket.dev/docs/socket-yml) for all options.

---

## Verification

After completing both steps:

1. **Dependabot** — Go to **Settings → Code security → Dependabot**. Within 24 hours, Dependabot should create its first update PRs if any dependencies are outdated. You can also check the **Insights → Dependency graph → Dependabot** tab.
2. **Socket** — Create a test PR that adds a new dependency to `package.json`. Socket should comment on the PR with a dependency analysis overview.
