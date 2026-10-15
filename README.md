# Project Genesis 2.0

A modern, type-safe full-stack monorepo starter built with Next.js, Express, oRPC, Drizzle ORM, and Clerk authentication.

## Tech Stack


| Layer           | Technology                                                   |
| --------------- | ------------------------------------------------------------ |
| Frontend        | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui |
| Backend         | Express 5, oRPC (type-safe RPC), BullMQ (jobs), Pino logging |
| Database        | PostgreSQL, Drizzle ORM                                      |
| Auth            | Clerk                                                        |
| Email           | Resend, React Email                                          |
| File Storage    | S3-compatible (Cloudflare R2 in production, MinIO locally)   |
| Error Tracking  | Rollbar (server + client)                                    |
| Product Analytics | Mixpanel (frontend, optional)                              |
| Hosting         | Render (API + worker + DB + Redis), Vercel (frontend)        |
| CI/CD           | GitHub Actions                                               |
| Validation      | Zod 4                                                        |
| Monorepo        | pnpm workspaces, TurboRepo                                   |
| Code Quality    | Biome (lint + format), CommitLint, Husky, lint-staged        |
| Security        | Dependabot (dependency updates), Socket.dev (supply chain)   |
| Test Coverage   | Codecov                                                      |


## Project Structure

```
genesis-2/
├── apps/
│   ├── server/              # Express API server (port 3000)
│   │   ├── drizzle.config.ts
│   │   ├── tests/           # Server unit + integration tests (Vitest)
│   │   └── src/
│   │       ├── index.ts     # Server entry — middleware stack & routes
│   │       ├── orpc/        # oRPC implementation
│   │       │   ├── index.ts         # Export appRouter and auth context
│   │       │   ├── auth-context.ts  # Clerk auth context extraction
│   │       │   ├── procedures.ts    # Public & protected procedures, user sync
│   │       │   └── routers/         # Route modules (user, email, health)
│   │       ├── db/          # Drizzle ORM layer
│   │       │   ├── db.ts           # Database client instance
│   │       │   ├── schema/         # Table definitions (users)
│   │       │   └── migrations/     # SQL migration files
│   │       ├── async-tasks/  # BullMQ background & scheduled jobs
│   │       │   ├── worker.ts          # Worker entry point (background + scheduled jobs)
│   │       │   ├── job-registry.ts    # Queue names, types, defaults, registration
│   │       │   └── jobs/              # Job definitions (one file per job)
│   │       │       ├── index.ts                  # Barrel — imports all jobs, re-exports registry
│   │       │       ├── sample-background.job.ts  # Example background task
│   │       │       ├── sample-scheduled.job.ts   # Example scheduled task
│   │       │       └── dead-letter.job.ts        # Dead letter queue handler
│   │       ├── email/       # Email service (Resend + React Email)
│   │       │   ├── client.ts       # Resend client singleton
│   │       │   ├── send.ts         # Generic sendEmail() function
│   │       │   ├── templates/      # React Email components (invite, etc.)
│   │       │   └── components/     # Shared email layout & styles
│   │       └── utils/
│   │           ├── env.ts          # Server env validation (t3-env + Zod)
│   │           ├── logger.ts       # Pino logger configuration
│   │           └── redis.ts        # Shared Redis connections (BullMQ)
│   ├── mobile/              # Expo (React Native) app — reuses shared/orpc/Clerk layer
│   │   ├── src/
│   │   │   ├── app/         # Expo Router file-based routes
│   │   │   ├── components/ui/ # Uniwind className-wrapped RN + native (@expo/ui) primitives
│   │   │   ├── global.css   # Tailwind v4 design tokens (seeded from packages/ui)
│   │   │   └── utils/
│   │   │       ├── orpc.ts          # oRPC client (mirrors web)
│   │   │       └── env.ts           # Mobile env validation (EXPO_PUBLIC_*)
│   │   └── CLAUDE.md        # Mobile-specific conventions (Uniwind, native UI, version pins)
│   └── web/                 # Next.js frontend (port 3001)
│       ├── src/
│       │   ├── app/         # App Router pages & layouts
│       │   │   ├── layout.tsx        # Root layout (Clerk + providers)
│       │   │   ├── sign-in/          # Clerk sign-in page
│       │   │   ├── sign-up/          # Clerk sign-up page
│       │   │   └── portal/           # Protected dashboard routes
│       │   ├── api/         # Client-side API wrappers (email, storage)
│       │   ├── components/  # App-level components (sidebar, header, etc.)
│       │   ├── providers/   # React context providers (theme, query, sidebar)
│       │   ├── proxy.ts     # Clerk route protection (Next.js 16 proxy)
│       │   └── utils/
│       │       ├── orpc.ts          # oRPC client setup + React Query integration
│       │       ├── env.ts           # Web env validation (t3-env + Zod)
│       │       └── tanstack-query.ts # React Query client
│       ├── tests/           # Web unit tests (Vitest + jsdom)
│       └── e2e/             # Playwright E2E tests
├── packages/
│   ├── orpc-contracts/      # Contract-first oRPC definitions
│   │   └── src/
│   │       ├── index.ts             # Export appContract + AppRouterClient type
│   │       └── contracts/           # Contract modules (user, email)
│   ├── shared/              # Shared Zod schemas and types
│   │   └── src/
│   │       └── models/              # User schemas, email schemas, preferences
│   ├── ui/                  # Shared component library (shadcn-based)
│   │   └── src/
│   │       ├── components/  # Button, Card, Input, Sheet, etc.
│   │       ├── hooks/       # use-mobile, use-is-mobile
│   │       └── styles/
│   │           └── globals.css # Design tokens, color palette, themes
├── docs/                    # Setup guides (docs/setup/) + engineering notes (docs/engineering/)
├── .github/                 # CI workflows (build, lint, tests, deploy) + Dependabot
├── docker-compose.yml       # Local infra: PostgreSQL, Redis, MinIO
├── docker-compose.test.yml  # Test DB for integration tests
├── Dockerfile               # Production image for the Render API + worker services
├── infra/terraform/         # Render + Vercel + GitHub provisioning
├── turbo.json               # Turbo task pipeline config
├── pnpm-workspace.yaml      # Workspace definition + version catalog
├── biome.json               # Linter & formatter config
├── commitlint.config.js     # Conventional commit rules
└── CLAUDE.md                # Engineering conventions + AI-agent context
```

## Architecture

### How It Works

Genesis follows a **monorepo architecture** where the frontend and backend share types, validation schemas, and UI components through internal packages:

```
┌─────────────┐     oRPC (HTTP)     ┌─────────────┐
│   Next.js   │ ──────────────────> │   Express   │
│   (web)     │ <────────────────── │   (server)  │
└──────┬──────┘                     └──────┬──────┘
       │                                   │
       │  imports                          │  imports
       ▼                                   ▼
┌──────────────────────────────────────────────────┐
│                    packages/                      │
│  ┌────────────────┐  ┌────────┐  ┌────┐          │
│  │ orpc-contracts │  │ shared │  │ ui │          │
│  └────────────────┘  └────────┘  └────┘          │
└──────────────────────────────────────────────────┘
```

**Contract-first oRPC** — Contracts in `packages/orpc-contracts` define the API surface (input/output schemas). The server implements contracts, the client consumes them. Both share type-safe schemas without coupling.

**End-to-end type safety** — Zod schemas (`packages/shared`) → oRPC contracts (`packages/orpc-contracts`) → server handlers → client. The web app imports contract types for full autocomplete and type checking, with no code generation step.

The server app (`apps/server`) contains the oRPC handlers, database layer (Drizzle ORM), and email service (Resend + React Email) — all colocated since db and email are implementation details of the API.

## Setup

### Step 0 — Start a new product from this template

Genesis is a **GitHub template repository**. Before any of the steps below, create your own product repo from it:

1. On GitHub, open the Genesis repo and click **Use this template → Create a new repository**. Check **Include all branches** so you inherit both permanent branches — `develop` (staging) and `main` (production) — see [Git Workflow](CLAUDE.md#git-workflow).
2. Clone your new repo and install dependencies:
   ```bash
   git clone <your-new-repo-url>
   cd <your-new-repo>
   pnpm install
   ```
3. Delete the template's in-flight feature branches — "Include all branches" copies *every* branch, and you only want `develop` and `main`:
   ```bash
   git branch -r | grep -vE 'origin/(develop|main|HEAD)$' | sed 's|.*origin/||' \
     | xargs -r -I{} git push origin --delete {}
   git fetch --prune
   ```
4. Rebrand the `genesis` placeholders to your product name with `pnpm rename <your-project-name>` — see [Rename the project](docs/setup/LOCAL_ENV.md#rename-the-project-new-product-from-the-template) for the naming rules and what it does (and doesn't) cover.

> **Before your first production release:** `develop` and `main` are inherited from the template with unrelated histories, so the first `develop → main` merge needs a one-time `git merge develop --allow-unrelated-histories`. See the [main-branch prerequisite in the production guide](docs/setup/manual/PROD_ENV.md#prerequisite--main-branch). Do this once, early, well before you release, and before `pnpm configure-repo` applies the `main` ruleset. [Branching and Releases](docs/engineering/branching-and-releases.md) covers the rest of the `develop`/`main` story.

Then continue with the integrations → local → staging → production flow below.

> **Use "Use this template", not "Fork".** A template gives you a clean, independent repo with its own history and no upstream link — the right choice for a new product. Fork only if you intend to contribute changes back to Genesis itself.

**Using Claude Code?** Run `/cl-setup` for interactive onboarding — it checks your environment, walks you through each step, and troubleshoots failures. The guides below are the source of truth; the skill is an experimental interactive layer on top of them.

### Recommended order

Work through the environments in this order — each builds on the previous one, and skipping ahead tends to waste time:

**1. Set up third-party integrations → 2. Local → 3. Staging → 4. Production**

### Step 1 — Set up third-party integrations first

Integrations fall into three tiers. Only Clerk is a hard requirement — for local, staging, and production alike. Everything else can be added later by updating `.env` values (or dashboards, for integrations that don't use env vars), so you can deploy first and layer them in as needed.

**Required for every environment (local, staging, production)** — the app will not start without this:

| Integration | Purpose | Impacts env vars? | Guide |
|-------------|---------|-------------------|-------|
| Clerk | Authentication (sign-in, sign-up, session management) | Yes (`CLERK_*`, `NEXT_PUBLIC_CLERK_*`) | [`integrations/CLERK.md`](docs/setup/integrations/CLERK.md) |

**Strongly recommended before shipping (or as soon as possible after)** — you can deploy to staging or production without these, but you'll want them in place before shipping, or layered in as soon as possible after:

| Integration | Purpose | Impacts env vars? | Guide |
|-------------|---------|-------------------|-------|
| Rollbar | Server + client error tracking | Yes (`ROLLBAR_SERVER_TOKEN`, `NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN`) | [`integrations/ROLLBAR.md`](docs/setup/integrations/ROLLBAR.md) |
| Repository security | Dependabot + Socket.dev supply chain scanning | No (GitHub app + config only) | [`integrations/REPO_SECURITY.md`](docs/setup/integrations/REPO_SECURITY.md) |
| Codecov | Test coverage reporting on PRs | No (GitHub secret + config only) | [`integrations/CODECOV.md`](docs/setup/integrations/CODECOV.md) |

**Optional — enable only if your product uses the feature**:

| Integration | Enable when you need… | Impacts env vars? | Guide |
|-------------|-----------------------|-------------------|-------|
| Resend | Transactional email (welcome, invites, password reset) | Yes (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`) | [resend.com](https://resend.com) |
| Cloudflare R2 | S3-compatible file storage on deployed envs (MinIO already covers local) | Yes (`S3_*`) | [`integrations/R2_STORAGE.md`](docs/setup/integrations/R2_STORAGE.md) |
| Custom domain | Your own domain on the deployed app | No (DNS + Vercel/Render dashboards) | [`integrations/CUSTOM_DOMAIN.md`](docs/setup/integrations/CUSTOM_DOMAIN.md) |
| BullMQ worker | Background + scheduled jobs on a separate Render service | No (`enable_worker` toggle in `terraform.tfvars`) | [`integrations/ENABLE_WORKER.md`](docs/setup/integrations/ENABLE_WORKER.md) |
| Apollo plugin | Claude Code feature/fix/PR workflows | No (local CLI tool) | [`integrations/APOLLO.md`](docs/setup/integrations/APOLLO.md) |
| Mixpanel | Product analytics + session replay for the web app | Yes (`NEXT_PUBLIC_MIXPANEL_TOKEN`) | [`integrations/MIXPANEL.md`](docs/setup/integrations/MIXPANEL.md) |

### Steps 2–4 — Environment guides

The deployed environments (staging + production) are provisioned via Terraform — one apply creates Render, Vercel, and the GitHub Environment secrets together, and CI deploys on every merge after that.

| Guide | Description |
|-------|-------------|
| [Local development](docs/setup/LOCAL_ENV.md) | Run the project on your machine |
| [Staging](docs/setup/STAGING.md) | Provision staging end-to-end via Terraform |
| [Production](docs/setup/PRODUCTION.md) | Provision production after staging works |
| [Add a new env](docs/setup/ADD_NEW_ENV.md) | Add a third environment beyond staging/production |
| [Update env vars](docs/setup/UPDATE_ENV_VARS.md) | Day-2: change a value in `.envrc`, redeploy auto-fires |
| [Pause services](docs/setup/PAUSE_SERVICES.md) | Temporarily stop the web service + worker without destroying data |
| [Destroy services](docs/setup/DESTROY_SERVICES.md) | Tear down a deployed env via `terraform destroy` — irreversible |
| [Running tests](docs/setup/integrations/RUNNING_TESTS.md) | Set up and run the full test suite locally |

Manual setup docs (legacy, kept as a backup) live at [`docs/setup/manual/`](docs/setup/manual/) — only follow these if you have a reason to skip Terraform.

## Common Commands

| Command | Description |
|---------|-------------|
| `pnpm run setup` | First-run bootstrap (creates `.env` files, starts infra, creates MinIO bucket, runs migrations) — idempotent |
| `pnpm infra:up` | Start local infrastructure (PostgreSQL, Redis, MinIO) — for day-to-day use after the first run |
| `pnpm dev` | Start all dev servers + worker (web + server + worker) |
| `pnpm dev:mobile` | Start the Expo mobile app (needs a simulator/device + the server running) — see [`apps/mobile/README.md`](apps/mobile/README.md) and [Local development](docs/setup/LOCAL_ENV.md#run-the-mobile-app-expo--optional) |
| `pnpm check` | Run Biome (lint + format) |
| `pnpm check-types` | Run TypeScript type checking |
| `pnpm build` | Build all packages |
| `pnpm db:migrate` | Run pending database migrations |
| `pnpm verify-deploy <render\|vercel>` | Trigger a platform deploy and poll its status API until the new build is live (invoked from Terraform's redeploy local-exec; not normally run by hand) |

Full list of scripts is in the root `package.json` — run `pnpm run` to see them all.

## Branching and Releases

Branch off `develop`, always. It is the default branch, it takes every approved PR, and it deploys to staging. `main` only moves when you cut a release, so `develop` permanently runs ahead of it. That gap is unreleased work, not drift to fix.

Two things about the divergence catch people out:

- **A repo created from this template inherits `develop` and `main` with unrelated histories.** The first `develop → main` merge fails with `refusing to merge unrelated histories` until you run the one-time `--allow-unrelated-histories` merge above. Do it early, not on release day.
- **A release PR must land as a merge commit, never a squash.** Squashing puts a commit on `main` that shares no history with `develop`, which reintroduces the divergence and makes every later release conflict on the same files.

Full details (measuring the gap, the release-merge procedure, resolving its conflicts, and merging `main` back into `develop` after a hotfix) are in [Branching and Releases](docs/engineering/branching-and-releases.md). The branch model and naming rules are in [Git Workflow](CLAUDE.md#git-workflow).

## CI / GitHub Actions

Every pull request to `develop` or `main` must pass these checks:

| Workflow | File | What it checks |
|----------|------|----------------|
| Build | `.github/workflows/build.yml` | `pnpm build` — all packages compile |
| Lint | `.github/workflows/lint.yml` | `pnpm check-types` + `pnpm biome check .` |
| PR Title | `.github/workflows/pr-title.yml` | PR title follows Conventional Commits |
| Server Tests | `.github/workflows/server-tests.yml` | Server unit + integration tests (provisions its own PostgreSQL) |
| Web Tests | `.github/workflows/web-tests.yml` | Frontend unit tests |

---

- **Conventions, gotchas, AI-agent context** — [`CLAUDE.md`](CLAUDE.md)
- **Testing patterns** — [`docs/engineering/testing-patterns.md`](docs/engineering/testing-patterns.md)
- **Branching, `develop`/`main` divergence, release merges**: [`docs/engineering/branching-and-releases.md`](docs/engineering/branching-and-releases.md)
