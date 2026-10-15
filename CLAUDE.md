# CLAUDE.md

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
| Working in a git worktree, starting infra/dev servers/tests, or anything involving local ports | `cl-parallel-sandboxes` |

Skip invocation only for trivial reads (answering questions about existing code without editing). When in doubt, invoke the skill — the cost is small and the cost of skipping a required step is large.

## Development

Local infra (PostgreSQL, Redis, MinIO) must be running via `pnpm infra:up` before `pnpm dev`.

Every git worktree runs in its own sandbox slot (own ports, containers, volumes). All infra/dev/test scripts are slot-aware; run `pnpm sandbox` to see the current worktree's ports. See `docs/engineering/parallel-sandboxes.md`.

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

### Code coverage gate

Coverage is compulsory and may never regress: ratchet the thresholds up, never down.

Full rationale, current floors, and the local `pre-push` behavior live in `docs/engineering/coverage-gate.md`.

## Architecture

### Monorepo Layout

- **apps/mobile/** — Expo (React Native, SDK 56) app using Expo Router. **Targets iOS and Android only, no web target** (web is `apps/web`). Reuses the shared data/auth layer: `@repo/shared` schemas, `@repo/orpc-contracts`, the oRPC client + TanStack Query (`src/utils/orpc.ts`, mirroring web), Clerk via `@clerk/expo` (token via `getClerkInstance()`, persisted in `expo-secure-store`). Env is `EXPO_PUBLIC_`-prefixed (`src/utils/env.ts`). Pins react/react-dom/react-native to Expo's exact versions (opts out of the workspace catalog; react-dom is needed at runtime by transitive deps, not for web). Navigation chrome and interactive controls are **native** (NativeTabs + native stack headers; Button/Switch are SwiftUI on iOS, Material 3 Compose on Android via `@expo/ui`). Presentation styling is **Uniwind + Tailwind v4**: `className` works directly on `react-native` components (third-party ones need `withUniwind`), with design tokens in `src/global.css` (`@variant light`/`dark` blocks) seeded from the web `packages/ui` tokens. Presentation components come from **react-native-reusables** (uniwind registry) via `pnpm ui:add:mobile <component>` into `src/components/ui/`. See `apps/mobile/CLAUDE.md` for the native UI strategy. `@repo/ui` itself is web-only and is NOT consumed here. Run with `pnpm dev:mobile` (needs a simulator/device + the server running).
- **packages/orpc-contracts/** — Contract-first oRPC definitions. Defines the API surface (input/output schemas) shared between server and client. Contracts reference Zod schemas from `@repo/shared`.
- **packages/shared/** — Single source of truth for all Zod schemas and types (`src/models/`). Used by contracts, server, and client.
- Each app has its own env validation in `src/env.ts` (server uses `@t3-oss/env-core`, web uses `@t3-oss/env-nextjs`).

### Key Patterns

- **Contract-first oRPC**: Contracts in `packages/orpc-contracts` define the API surface with input/output Zod schemas. Server implements contracts via `@orpc/server`. Client consumes contracts via `@orpc/client`. Both share type-safe schemas without coupling.
- **End-to-end type safety**: Zod schemas (`packages/shared`) → oRPC contracts (`packages/orpc-contracts`) → server handlers (`apps/server`) → client (`apps/web`). The web app imports contract types for full autocomplete.
- **Auth flow**: Clerk handles auth on both sides. The oRPC client (`apps/web/src/utils/orpc.ts`) attaches JWT tokens. The server validates via Clerk middleware.
- **User sync**: `protectedProcedure` in `apps/server/src/orpc/procedures.ts` auto-inserts the Clerk user into the PostgreSQL `users` table on first authenticated request (insert with `onConflictDoNothing`, so existing users are not updated).
- **Environment variables**: Validated at startup via `src/env.ts` in each app (t3-env + Zod). See the Environment Variables section below for the inventory pointer.
- **Error tracking**: Rollbar is integrated on both server and client. Server-side: `apps/server/src/utils/rollbar.ts` exports an always-created `rollbar` instance (`enabled: false` when no token). Client-side: `@rollbar/react` Provider wraps the app in `apps/web/src/providers/providers.tsx`, auto-tracking the Clerk user. Both are disabled gracefully when tokens are absent.

## Git Workflow

### Permanent Branches

| Branch | Deploys to | Purpose |
|--------|-----------|---------|
| `develop` | Staging | Default branch. All active development flows here. |
| `main` | Production | Stable, released code only. Never committed to directly. |

During MVP, only the staging environment (the `develop` branch) is deployed. `main` is dormant, so `develop` permanently runs ahead of it. That divergence, the one-time unrelated-histories merge a template-derived repo needs, and how to run a release merge are covered in [Branching and Releases](docs/engineering/branching-and-releases.md).

### Branch Naming

Day-to-day branches use a flat format enforced by the pre-push hook:

Format: `<prefix>-<issue-number>-<short-description>`
Pattern: `^[a-z]+-[0-9]+-[a-z0-9]+(-[a-z0-9]+)*$`

Examples: `genesis-254-issue-lifecycle-labels`, `genesis-256-portal-sidebar-autoclose`

- All lowercase, hyphen-separated, no slashes
- Must start with a prefix, then the GitHub issue number, then a description
- Tickets live on GitHub Issues (the Notion board is historical). Create the issue first; the branch number is the issue number. An issue labeled `planning`, `dev-in-progress`, or `in-review` is already claimed — skip it. Pushing the branch applies `dev-in-progress` automatically via `issue-lifecycle.yml`; the apollo pipeline may later swap it to `planning`, which still means claimed

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

Must follow Conventional Commits format: `type(scope): message`. Validated by CI (`pr-title.yml`). Use the branch's issue reference as the scope (e.g. `ci(genesis-254): auto-adjust issue lifecycle labels`), and link the issue in the PR body with a closing keyword (`Closes #254`) so the lifecycle labels auto-adjust.

## Code Style

- **Biome** for linting and formatting (not ESLint/Prettier). Tab indentation, double quotes.
- **Commit messages**: Conventional Commits enforced by commitlint + husky. Format: `type(scope): message`. Scope is required (lowercase). Max 100 chars. Allowed types: feat, fix, chore, refactor, docs, ci, build, test, perf, style, revert.
- **TypeScript**: Strict mode everywhere. `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters` enabled. ESNext target with bundler module resolution.
- **Pre-commit hook**: Runs Biome check on staged files via lint-staged.
- **Pre-push hook**: Validates branch naming conventions.

## Code comments

First focus is always making code simple and readable. Comments are a last resort, not a substitute for clarity: comments rot, drift from the code, and signal that the code itself failed to communicate.

**How to apply:**

1. Before writing a comment, try to fix the code instead: rename for intent, extract a well-named helper, simplify control flow, replace magic numbers with named constants.
2. Only add a comment when, after simplification, the code still has a non-obvious WHY: a hidden constraint, a workaround for a specific bug, a subtle invariant, or behavior that would genuinely surprise a careful reader.
3. Never explain WHAT the code does; identifiers already do that.
4. Skip boilerplate docstrings, section banners, ticket refs, and "used by X" notes. They belong in PR descriptions, not the code.
5. If a comment is needed to explain a function, that is a signal to rewrite the function, not to keep the comment.

**Comment style:** In C-style languages (JS/TS/TSX, CSS), multi-line comments always use a JSDoc-style block (`/** ... */` with leading `*` on each line), and single-line comments stay as `//`; only switch to the block form when the comment needs more than one line. In `#`-comment languages (shell, YAML), there is no block form: every line is a `#` line comment, single- or multi-line.

**Simplicity does not mean dropping correctness.** If a branch, guard, or check exists because of a real case (null input, race, boundary value, failure mode), preserve that behavior when simplifying. Removing logic is only safe when the case it covered cannot occur. When in doubt, keep the check and simplify around it.

## Environment Variables

Validated at startup via `src/env.ts` in each app (t3-env + Zod). Never read or write `.env` files directly: always go through the validated `env.ts`.

The full server/web/mobile variable inventory and the add-a-variable checklist live at `.claude/skills/cl-adding-environment-variable/references/env-vars.md`.

## Engineering Practices

> The following engineering practices are the standard for all new code. Existing code may not yet conform — when you touch a file that violates these patterns, fix the non-conforming code in that file as part of your change.

- **Backend patterns:** Use `/cl-backend-patterns` skill for controller, service, and database entity conventions
- **Frontend patterns:** Use `/cl-frontend-patterns` skill for component organization, state management, container/presentation
- **Error handling:** Use `/cl-error-handling` skill for ORPCError usage and validation flow
- **Design system:** Use `/cl-design-agent` skill for UI consistency

## Authorization (RBAC)

End-to-end role-based access layered across edge middleware, route config, sidebar filter, and component-level gates. Roles live in `packages/shared/src/models/user.types.ts` — always use the `Roles.ADMIN` / `Roles.MEMBER` constants, never raw `"admin"` / `"member"` strings.

For the three-file recipe to add a role-restricted portal route, read `.claude/skills/cl-frontend-patterns/references/role-restricted-routes.md`.

### Component-level gating

Wrap any subtree in `<Authorizer allowedRoles={[Roles.ADMIN]}>` from `apps/web/src/components/authorizer.tsx`. Loading → renders nothing; unauthorized → renders the optional `fallback` prop (defaults to null). Authorizer never redirects — it only hides UI. For full-page gating, use a route entry instead.

### Backend procedures

Compose `requireRole` on `protectedProcedure`:

```ts
import { Roles } from "@repo/shared";
import { requireRole } from "../middleware";

export const adminOnly = protectedProcedure
  .use(requireRole(Roles.ADMIN))
  .handler(...);
```

`requireRole(...roles)` reads `context.dbUser.role` (loaded once in `protectedProcedure`) — no extra DB queries. Throws `ORPCError("FORBIDDEN")` on role mismatch. Variadic, so `requireRole(Roles.ADMIN, Roles.MEMBER)` accepts either.

## Gotchas

- **Terminology**: Never refer to Genesis as a "boilerplate". It is a **platform**. Use "platform" in all user-facing communication, docs, PRs, and commit messages.
- **Date utilities**: Use `date-fns` (v4) for all date formatting, parsing, and manipulation. Do not use `moment`, `dayjs`, or raw `Date` methods for formatting/parsing.
- **New dependencies**: Do not add a new dependency without first confirming the requirement cannot be met by an existing dependency or a built-in Node.js API. When a new dependency is genuinely needed, explain the justification before installing. (Supply chain hardening — minimizes attack surface and maintenance burden.)
- **Dependency age gate**: `pnpm-workspace.yaml` sets `minimumReleaseAge: 10080` (7 days), so `pnpm install` / `pnpm add` / Dependabot will refuse package versions younger than that. Compromised npm releases are usually caught and yanked inside this window. If you legitimately need a fresher version, add the package name to a `minimumReleaseAgeExclude:` list in `pnpm-workspace.yaml` rather than removing the global setting.
- **pnpm config lives in `pnpm-workspace.yaml`**, not `package.json.pnpm`. Both `overrides` (transitive pins) and `allowBuilds` (postinstall script allowlist — explicit `true`/`false` per package) are declared there. New deps with install scripts must be added to `allowBuilds`, or pnpm will silently skip them.
- Install packages at the **workspace root** (`pnpm add <pkg>`), not inside individual apps.
- Environment variables: never read/write `.env` files directly — always go through the validated `env.ts` in each app.
- The `packages/ui` component library uses `@base-ui/react` primitives, not raw Radix — check existing components before adding new dependencies.
- Frontend env vars must be prefixed with `NEXT_PUBLIC_` to be available in the browser.
- oRPC errors use `ORPCError` codes (e.g., `"UNAUTHORIZED"`, `"NOT_FOUND"`), not custom error classes.
- **Forms**: Always use TanStack Form (`useForm`) with Zod schema validation for any form — never use multiple `useState` for field values, field errors, and submission state. Use `z.string().email()` for email validation, not raw regex. See `/cl-frontend-patterns` and its `references/creating-forms.md`.
- Drizzle schema column names use camelCase in TypeScript but map to snake_case in PostgreSQL.
- `protectedProcedure` auto-inserts new Clerk users into the DB but uses `onConflictDoNothing` — it will NOT update existing user records. If you need to sync changed user data, handle it separately.
- `CORS_ORIGIN` accepts a comma-separated list of full browser origin URLs (each must include the scheme, e.g. `http://localhost:3001`). Use multiple entries for forks that need a staging origin plus a preview URL. Each entry is validated as a URL at startup; bare hostnames or `*` will fail. The first entry is treated as the primary app URL and is used in transactional email links.
- Both `env.ts` files skip validation when `CI=true` (`skipValidation: process.env.CI === "true"`). CI will not catch env schema mismatches.
- **S3 storage** uses server-proxied uploads — files go through Express to S3, not directly from the browser. The `files` table stores metadata; actual bytes live in the S3 bucket.
- `forcePathStyle: true` is required on the S3 client for MinIO and Cloudflare R2 compatibility.
- All storage operations (upload, list, file URL, delete) go through oRPC. File uploads use oRPC's native `File`/`Blob` support via `oz.file()` from `@orpc/zod` — no separate Express route or multer needed. Presigned GET URLs returned to clients are signed against `S3_PUBLIC_ENDPOINT` (when set) so that clients not on the server's host can reach the storage endpoint. AWS SigV4 covers the host header, so the signing endpoint and the access endpoint must match.
- MinIO must be running (`pnpm infra:up` starts all services including MinIO) before using storage locally. Create the default bucket via the MinIO console at `http://localhost:9001` (login: genesis / genesis123).
- The `files` table uses soft delete (`deletedAt`). Queries must filter `WHERE deleted_at IS NULL` to exclude deleted files. The S3 object is removed on delete, but the metadata row persists.
- **Table ID convention**: All tables use a `serial` integer `id` as the primary key (better for indexing, joins, foreign keys) and a separate `uuid` column with a unique constraint for external/API references (prevents enumeration). Both are auto-generated. Use `id` for internal queries, joins, and foreign keys. Use `uuid` in API inputs/outputs — never expose the integer `id` in API responses. Apply this pattern to all new tables.
- Rollbar only receives **server-side 5xx errors** (oRPC errors with `status >= 500`). Client errors (4xx) are not reported — they're expected application behavior, not bugs.

## Maintenance

When you encounter a project-specific mistake or a new convention not covered by existing guidelines, add it to `docs/engineering/proposed-rules.md` instead of modifying CLAUDE.md directly.

When creating, modifying, or restructuring any skill (SKILL.md files, references, or skill architecture), always invoke the `/skill-creator` skill first for guidance on structure, progressive disclosure, and description optimization.
