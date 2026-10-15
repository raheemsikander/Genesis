# Server

Express 5 API server. Entry: `src/index.ts`. Runs on port 3000. Serves oRPC at `/rpc`.

## Required skills for this directory

You **must** invoke these skills via the `Skill` tool **before** editing files here. They take priority over generic plugin skills (e.g. `incremental-implementation`, `api-and-interface-design`) when working in `apps/server/`.

**Examples below are illustrative, not exhaustive.** The path rule wins over the example list. And many tasks need more than one skill — e.g. wiring an external service = `cl-backend-patterns` + `cl-adding-environment-variable` + any service-specific plugin skill (`sentry:sentry-sdk-setup`, etc.). Invoke all that apply.

| If you're touching… | Invoke skill |
|---|---|
| **Any file under `apps/server/`** (e.g. controllers, services, oRPC handlers, Drizzle entities, migrations, jobs, utilities, monitoring, error tracking, integrations, auth glue) | `cl-backend-patterns` |
| Any `ORPCError` throw, Zod schema, or input validation | `cl-error-handling` |
| Any new or modified env var, `.env.example`, or `src/utils/env.ts` | `cl-adding-environment-variable` |
| `apps/server/src/email/` or any new transactional email | `cl-adding-email-template` |

Skip invocation only for trivial reads (e.g. just answering a question about existing code without editing).
