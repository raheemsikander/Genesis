# CLAUDE.md

## Project Overview

This is the project-genesis monorepo platform — a production-ready starting point for full-stack web applications using a Next.js 16 frontend + Express 5 backend, connected via oRPC for end-to-end type-safe RPC. It uses pnpm workspaces + TurboRepo and provides the foundational architecture, engineering conventions, shared packages, and CI/CD pipeline that new projects extend with domain-specific features.

## Skill Triggers (mandatory)

**Before** editing files in this repo, invoke the matching project skill via the `Skill` tool. Project skills take priority over generic plugin skills (e.g. `incremental-implementation`, `frontend-ui-engineering`, `api-and-interface-design`) when both could apply — they encode required steps that are easy to miss.

**Examples in the table below are illustrative, not exhaustive.** The path rule wins over the example list. If the file lives in the listed directory and isn't pure text/config, invoke the skill — even if the work (utility, monitoring, integration, error tracking, etc.) isn't one of the named examples.

**Many tasks need multiple skills at once.** Integrating a new service (Sentry, Rollbar, Stripe, etc.) typically needs `cl-adding-environment-variable` + `cl-backend-patterns` and/or `cl-frontend-patterns` + any service-specific plugin skill (`sentry:sentry-sdk-setup`, etc.). Invoke all that apply; don't stop at the first match.

| If the task touches… | Invoke skill |
|---|---|
| Any new or renamed env var, or any file under `apps/*/src/utils/env.ts` / `.env.example` | `cl-adding-environment-variable` |
| Any file in `apps/server/src/email/`, or adding a new transactional email | `cl-adding-email-template` |
| **Any file under `apps/server/`** (e.g. controllers, services, oRPC handlers, Drizzle entities, migrations, jobs, utilities, monitoring, error tracking, integrations) | `cl-backend-patterns` |
| **Any file under `apps/web/`** (e.g. pages, components, hooks, forms, routes, oRPC client calls, providers, error boundaries, utilities, client-side monitoring) | `cl-frontend-patterns` |
| Any file under `packages/ui/` OR any mobile/responsive work anywhere in `apps/web/` (components, design tokens, styles, theme, breakpoints, viewport behavior, touch targets) | `cl-design-agent` |
| Any file under `packages/shared/` (Zod schemas, validation logic, shared types, error shapes) | `cl-error-handling` |
| First-time setup, onboarding, deploy config (Render + Vercel) | `cl-setup` |

Skip invocation only for trivial reads (answering questions about existing code without editing). When in doubt, invoke the skill — the cost is small and the cost of skipping a required step is large. See `## Skills Reference` further down for what each skill contains.

## Development

```bash
pnpm infra:up           # Start local infra (PostgreSQL, Redis, MinIO) — required before dev
pnpm dev                # Start both web (port 3001) and server (port 3000)
pnpm dev:web            # Next.js only
pnpm dev:server         # Express only
pnpm infra:down         # Stop local infra (data is preserved)
```

### Database

```bash
pnpm db:push            # Push Drizzle schema to database
pnpm db:generate        # Generate migration files
pnpm db:migrate         # Run pending migrations
pnpm db:studio          # Open Drizzle Studio GUI
```

## Build & Tooling

```bash
pnpm build              # Build all packages (turbo)
pnpm check-types        # TypeScript type checking
pnpm check              # Biome lint + format (auto-fixes with --write)
pnpm ui:add <component> # Add a shadcn/ui component
```

No automated deployment pipeline is configured yet. Build output is verified via `pnpm build` in CI.

## Verification

Always run these before considering work complete:

```bash
pnpm check-types        # Must pass — catches type errors across the monorepo
pnpm check              # Must pass — Biome lint + format (auto-fixes via --write)
pnpm build              # Must pass — ensures all packages compile
pnpm test:server:unit   # Must pass — server unit tests
pnpm test:server:integration  # Must pass — server integration tests (auto-starts test DB, requires TEST_DATABASE_URL)
```

## Architecture

### Monorepo Layout

- **apps/server/** — Express 5 API server. Entry: `src/index.ts`. Uses Clerk auth middleware, Pino logging, serves oRPC at `/rpc` and OpenAPI docs at `/api-reference` (dev only). Contains oRPC handlers (`src/orpc/`), Drizzle ORM database layer (`src/db/`), and email service (`src/email/`). `protectedProcedure` (requires Clerk auth, auto-inserts user to DB if not exists). Drizzle config at `drizzle.config.ts`.
- **apps/web/** — Next.js 16 (App Router) frontend. Uses React 19 compiler, Clerk for auth, TanStack Query for data fetching, oRPC client for typed API calls.
- **packages/orpc-contracts/** — Contract-first oRPC definitions. Defines the API surface (input/output schemas) shared between server and client. Contracts reference Zod schemas from `@genesis/shared`.
- **packages/shared/** — Single source of truth for all Zod schemas and types (`src/models/`). Used by contracts, server, and client. Exports user schemas (`UserSchema`, `UserPreferences`), email schemas (`InviteEmailInputSchema`, `InviteEmailSendResultSchema`), email template types (`EmailTemplates`, `EmailTemplateName`, `EmailTemplateData`), and their inferred types.
- **packages/ui/** — Component library using `@base-ui/react` primitives (added via shadcn CLI) with custom design system (CSS variables, light/dark themes). Exports components, hooks, styles, and PostCSS config.
- **tsconfig.base.json** (root) — Shared TypeScript config extended by all packages and apps.
- Each app has its own env validation in `src/env.ts` (server uses `@t3-oss/env-core`, web uses `@t3-oss/env-nextjs`).

### Key Patterns

- **Contract-first oRPC**: Contracts in `packages/orpc-contracts` define the API surface with input/output Zod schemas. Server implements contracts via `@orpc/server`. Client consumes contracts via `@orpc/client`. Both share type-safe schemas without coupling.
- **End-to-end type safety**: Zod schemas (`packages/shared`) → oRPC contracts (`packages/orpc-contracts`) → server handlers (`apps/server`) → client (`apps/web`). The web app imports contract types for full autocomplete.
- **Auth flow**: Clerk handles auth on both sides. The oRPC client (`apps/web/src/utils/orpc.ts`) attaches JWT tokens. The server validates via Clerk middleware.
- **User sync**: `protectedProcedure` in `apps/server/src/orpc/procedures.ts` auto-inserts the Clerk user into the PostgreSQL `users` table on first authenticated request (insert with `onConflictDoNothing` — existing users are not updated).
- **Environment variables**: Validated at startup via `src/env.ts` in each app (t3-env + Zod). See the Environment Variables section below for full details.
- **Error tracking**: Rollbar is integrated on both server and client. Server-side: `apps/server/src/utils/rollbar.ts` exports an always-created `rollbar` instance (`enabled: false` when no token). Client-side: `@rollbar/react` Provider wraps the app in `apps/web/src/providers/providers.tsx`, auto-tracking the Clerk user. Both are disabled gracefully when tokens are absent.

### Frontend Routes

Public: `/`, `/sign-in/*`, `/sign-up/*`. Protected (under `portal/`): dashboard, profile, about, and design system showcase pages (colors, typography, components, email).

## Git Workflow

### Permanent Branches

| Branch | Deploys to | Purpose |
|--------|-----------|---------|
| `develop` | Staging | Default branch. All active development flows here. |
| `main` | Production | Stable, released code only. Never committed to directly. |

During MVP, only the staging environment (the `develop` branch) is deployed. `main` is dormant.

### Branch Naming

Day-to-day branches use a flat format enforced by the pre-push hook:

Format: `<prefix>-<number>-<short-description>`
Pattern: `^[a-z]+-[0-9]+-[a-z0-9]+(-[a-z0-9]+)*$`

Examples: `genesis-42-user-invites`, `genesis-54-security-vulnerabilities`

- All lowercase, hyphen-separated, no slashes
- Must start with a prefix, then a numeric ticket ID, then a description

The hook also allows `release/*`, `hotfix/*`, and `dependabot/*` branches to bypass the pattern check.

### Day-to-Day Flow

```
develop
  └── genesis-42-user-invites   ← branch off develop
        └── (work, commit, push)
        └── open PR → develop
        └── CI checks pass + 1 approval
        └── merge → develop

For MVP (skip release branch):
develop → open PR → main        ← production release
```

### Hotfix Flow

```
main
  └── hotfix/critical-bug    ← branch off main
        └── (fix)
        └── merge → main     ← immediate fix
        └── merge → develop  ← keep in sync
```

### PR Titles

Must follow Conventional Commits format: `type(scope): message`. Validated by CI (`pr-title.yml`).

### CI Requirements

All PRs must pass before merge:

| Workflow | What it checks |
|----------|---------------|
| `build.yml` | Full monorepo build (server + web) |
| `server-tests.yml` | Server unit tests + integration tests (PostgreSQL service) |
| `web-tests.yml` | Frontend unit tests |
| `lint.yml` | TypeScript types + Biome lint/format |
| `pr-title.yml` | PR title follows Conventional Commits format |

### Security Scanning

- **Dependabot** — Automated weekly PRs for dependency updates (`.github/dependabot.yml`). Groups minor/patch updates to reduce noise. Also covers GitHub Actions versions.
- **Socket.dev** — GitHub App for PR-level supply chain analysis (`socket.yml`). Detects typosquatting, malicious install scripts, network access, obfuscated code in new/updated dependencies.

## Code Style

- **Biome** for linting and formatting (not ESLint/Prettier). Tab indentation, double quotes.
- **Commit messages**: Conventional Commits enforced by commitlint + husky. Format: `type(scope): message`. Scope is required (lowercase). Max 100 chars. Allowed types: feat, fix, chore, refactor, docs, ci, build, test, perf, style, revert.
- **TypeScript**: Strict mode everywhere. `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters` enabled. ESNext target with bundler module resolution.
- **Pre-commit hook**: Runs Biome check on staged files via lint-staged.
- **Pre-push hook**: Validates branch naming conventions.

## Key Config Files

| File | Purpose |
|------|---------|
| `turbo.json` | TurboRepo pipeline — caching, task dependencies |
| `pnpm-workspace.yaml` | pnpm workspace package definitions |
| `tsconfig.base.json` | Shared TypeScript config (strict mode) |
| `biome.json` | Linting + formatting (tab indentation, double quotes) |
| `commitlint.config.js` | Conventional Commits enforcement |
| `.lintstagedrc.mjs` | Pre-commit staged file checks |
| `apps/server/drizzle.config.ts` | Drizzle ORM database config |

## Environment Variables

Validated at startup via `src/env.ts` in each app (t3-env + Zod). Never read/write `.env` files directly — always go through the validated `env.ts`.

**Server** (`apps/server/src/utils/env.ts`):
- Required: `DATABASE_URL`, `CORS_ORIGIN`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`
- Optional: `PORT` (defaults to `3000`), `REDIS_URL` (BullMQ worker connection), `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (email service), `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (S3-compatible storage), `S3_REGION` (defaults to `"us-east-1"`), `S3_BUCKET` (defaults to `"file-uploads"`), `DB_POOL_MAX` (PostgreSQL connection pool size, defaults to `20`), `NODE_ENV` (defaults to `"development"`), `LOG_LEVEL` (defaults to `"info"`), `ROLLBAR_SERVER_TOKEN` (error tracking)

**Web** (`apps/web/src/utils/env.ts`) — all prefixed with `NEXT_PUBLIC_`:
- Required: `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
- Optional: `NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN`, `NEXT_PUBLIC_NODE_ENV` (defaults to `"development"`)

When adding a new environment variable, update ALL applicable locations:

### Server-side variables

1. `apps/server/src/utils/env.ts` — add to the t3-env schema (required or optional)
2. `apps/server/.env.example` — add example value for other developers
3. This CLAUDE.md section — keep the list above current

### Client-side variables (prefixed with `NEXT_PUBLIC_`)

1. `apps/web/src/utils/env.ts` — add to the t3-env schema (required or optional)
2. `apps/web/.env.example` — add example value for other developers
3. This CLAUDE.md section — keep the list above current

## Engineering Practices

> The following engineering practices are the standard for all new code. Existing code may not yet conform — when you touch a file that violates these patterns, fix the non-conforming code in that file as part of your change.

- **Backend patterns:** Use `/cl-backend-patterns` skill for controller, service, and database entity conventions
- **Frontend patterns:** Use `/cl-frontend-patterns` skill for component organization, state management, container/presentation
- **Error handling:** Use `/cl-error-handling` skill for ORPCError usage and validation flow
- **Design system:** Use `/cl-design-agent` skill for UI consistency

## Gotchas

- **Terminology**: Never refer to Genesis as a "boilerplate". It is a **platform**. Use "platform" in all user-facing communication, docs, PRs, and commit messages.
- **Date utilities**: Use `date-fns` (v4) for all date formatting, parsing, and manipulation. Do not use `moment`, `dayjs`, or raw `Date` methods for formatting/parsing.
- **New dependencies**: Do not add a new dependency without first confirming the requirement cannot be met by an existing dependency or a built-in Node.js API. When a new dependency is genuinely needed, explain the justification before installing. (Supply chain hardening — minimizes attack surface and maintenance burden.)
- Install packages at the **workspace root** (`pnpm add <pkg>`), not inside individual apps.
- Environment variables: never read/write `.env` files directly — always go through the validated `env.ts` in each app.
- The `packages/ui` component library uses `@base-ui/react` primitives, not raw Radix — check existing components before adding new dependencies.
- Frontend env vars must be prefixed with `NEXT_PUBLIC_` to be available in the browser.
- oRPC errors use `ORPCError` codes (e.g., `"UNAUTHORIZED"`, `"NOT_FOUND"`), not custom error classes.
- **Forms**: Always use TanStack Form (`useForm`) with Zod schema validation for any form — never use multiple `useState` for field values, field errors, and submission state. Use `z.string().email()` for email validation, not raw regex. See `/cl-frontend-patterns` and its `references/creating-forms.md`.
- Drizzle schema column names use camelCase in TypeScript but map to snake_case in PostgreSQL.
- `protectedProcedure` auto-inserts new Clerk users into the DB but uses `onConflictDoNothing` — it will NOT update existing user records. If you need to sync changed user data, handle it separately.
- `CORS_ORIGIN` is validated with `z.url()` — values like `*` or `localhost:3000` (no scheme) will fail at startup. Must be a full URL (e.g., `http://localhost:3001`).
- Both `env.ts` files skip validation when `CI=true` (`skipValidation: process.env.CI === "true"`). CI will not catch env schema mismatches.
- **S3 storage** uses server-proxied uploads — files go through Express to S3, not directly from the browser. The `files` table stores metadata; actual bytes live in the S3 bucket.
- `forcePathStyle: true` is required on the S3 client for MinIO and Cloudflare R2 compatibility.
- All storage operations (upload, list, file URL, delete) go through oRPC. File uploads use oRPC's native `File`/`Blob` support via `oz.file()` from `@orpc/zod` — no separate Express route or multer needed.
- MinIO must be running (`pnpm infra:up` starts all services including MinIO) before using storage locally. Create the default bucket via the MinIO console at `http://localhost:9001` (login: genesis / genesis123).
- The `files` table uses soft delete (`deletedAt`). Queries must filter `WHERE deleted_at IS NULL` to exclude deleted files. The S3 object is removed on delete, but the metadata row persists.
- **Table ID convention**: All tables use a `serial` integer `id` as the primary key (better for indexing, joins, foreign keys) and a separate `uuid` column with a unique constraint for external/API references (prevents enumeration). Both are auto-generated. Use `id` for internal queries, joins, and foreign keys. Use `uuid` in API inputs/outputs — never expose the integer `id` in API responses. Apply this pattern to all new tables.
- Rollbar only receives **server-side 5xx errors** (oRPC errors with `status >= 500`). Client errors (4xx) are not reported — they're expected application behavior, not bugs.

## Skills Reference

Workflow skills (provided by apollo plugin):
- `/apollo:cl-kickstart` — Create Notion ticket + feature branch, triage, and route to the right workflow
- `/apollo:cl-feature` — Full feature lifecycle (brainstorm → plan → implement → finish)
- `/apollo:cl-fix` — Bug investigation and fix workflow
- `/apollo:cl-quick` — Small, clear-scope tasks (config changes, minor updates)
- `/apollo:cl-finish` — Wrap up: lint, build, test, code review, PR creation, ticket update
- `/apollo:cl-pr-splitter` — Break features into smaller, independently reviewable PRs

Pattern and convention skills (architecture guidance):
- `/cl-backend-patterns` — Backend architecture, service layer, DB entity conventions. Includes reference guides for adding endpoints, database entities, and middleware.
- `/cl-frontend-patterns` — Component organization, state management, container/presentation, API hooks, forms, routing
- `/cl-error-handling` — ORPCError usage, validation flow
- `/cl-design-agent` — Design system consistency

Onboarding skills:
- `/cl-setup` — Interactive onboarding for engineers forking Genesis as a platform (local setup, tests, CI, deployment)

How-to skills (step-by-step recipes):
- `/cl-adding-environment-variable` — Add env vars with validation
- `/cl-adding-email-template` — Add email templates

## Maintenance

When you encounter a project-specific mistake or a new convention not covered by existing guidelines, add it to `docs/engineering/proposed-rules.md` instead of modifying CLAUDE.md directly.

When creating, modifying, or restructuring any skill (SKILL.md files, references, or skill architecture), always invoke the `/skill-creator` skill first for guidance on structure, progressive disclosure, and description optimization.
