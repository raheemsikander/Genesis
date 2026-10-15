# Web

Next.js 16 (App Router) frontend. Runs on port 3001. Uses Clerk auth and oRPC client for typed API calls.

## Required skills for this directory

You **must** invoke these skills via the `Skill` tool **before** editing files here. They take priority over generic plugin skills (e.g. `incremental-implementation`, `frontend-ui-engineering`) when working in `apps/web/`.

**Examples below are illustrative, not exhaustive.** The path rule wins over the example list. And many tasks need more than one skill — e.g. wiring a client-side service = `cl-frontend-patterns` + `cl-adding-environment-variable` + any service-specific plugin skill (`sentry:sentry-sdk-setup`, etc.). Invoke all that apply.

| If you're touching… | Invoke skill |
|---|---|
| **Any file under `apps/web/`** (e.g. pages, layouts, components, hooks, forms, routes, providers, error boundaries, utilities, client-side monitoring, auth glue) | `cl-frontend-patterns` |
| Any UI component, styling, layout, spacing, typography, theme token, or responsive/mobile work (breakpoints, viewport behavior, touch targets, mobile-specific layout) | `cl-design-agent` |
| Any form validation, error handling, or Zod schema | `cl-error-handling` |
| Any new or modified env var (note: client-side vars must be `NEXT_PUBLIC_*`) | `cl-adding-environment-variable` |

Skip invocation only for trivial reads (e.g. just answering a question about existing code without editing).
