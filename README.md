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
│   │       ├── components/  # Button, Card, Input, Sidebar, etc.
│   │       ├── hooks/       # use-mobile, use-is-mobile
│   │       └── styles/
│   │           └── globals.css # Design tokens, color palette, themes
├── docs/                    # Setup guides (docs/setup/) + engineering notes (docs/engineering/)
├── .github/                 # CI workflows (build, lint, tests, deploy) + Dependabot
├── docker-compose.yml       # Local infra: PostgreSQL, Redis, MinIO
├── docker-compose.test.yml  # Test DB for integration tests
├── Dockerfile               # Production image for the Render API + worker services
├── render.yaml              # Render Blueprint — defines all deployed environments
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

**Using Claude Code?** Run `/cl-setup` for interactive onboarding — it checks your environment, walks you through each step, and troubleshoots failures. The guides below are the source of truth; the skill is an experimental interactive layer on top of them.

| Guide | Description |
|-------|-------------|
| [Local development](docs/setup/LOCAL_ENV.md) | Run the project on your machine |
| [Staging environment](docs/setup/STAGING_ENV.md) | Set up the staging environment on Render + Vercel |
| [Production environment](docs/setup/PROD_ENV.md) | Set up the production environment |
| [Adding an environment](docs/setup/NEW_ENV.md) | Add a new deployed environment (e.g. staging) |
| [Environment variables](docs/setup/ENV_VARS.md) | Reference for all deployed env vars (Render + Vercel + GitHub) |
| [Custom domain](docs/setup/integrations/CUSTOM_DOMAIN.md) | Connect a custom domain to any Vercel environment |
| [Running tests](docs/setup/integrations/RUNNING_TESTS.md) | Set up and run the full test suite locally |

**Optional integrations** — the project works fully without these. Set them up when your team is ready:

| Guide | Description |
|-------|-------------|
| [S3 storage (Cloudflare R2)](docs/setup/integrations/R2_STORAGE.md) | S3-compatible file storage for uploads |
| [Error tracking (Rollbar)](docs/setup/integrations/ROLLBAR.md) | Server + client error tracking |
| [Codecov](docs/setup/integrations/CODECOV.md) | Coverage reporting on PRs |
| [Repository security](docs/setup/integrations/REPO_SECURITY.md) | Dependabot dependency updates + Socket.dev supply chain scanning |
| [Apollo plugin](docs/setup/integrations/APOLLO.md) | Claude Code plugin for feature/fix/PR workflows |

## Common Commands

| Command | Description |
|---------|-------------|
| `pnpm infra:up` | Start local infrastructure (PostgreSQL, Redis, MinIO) |
| `pnpm dev` | Start all dev servers + worker |
| `pnpm check` | Run Biome (lint + format) |
| `pnpm check-types` | Run TypeScript type checking |
| `pnpm build` | Build all packages |
| `pnpm db:migrate` | Run pending database migrations |

Full list of scripts is in the root `package.json` — run `pnpm run` to see them all.

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
