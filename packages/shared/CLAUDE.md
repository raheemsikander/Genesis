# Shared Package

Single source of truth for Zod schemas and inferred TypeScript types used across the monorepo. Imported by `@repo/orpc-contracts`, `apps/server`, and `apps/web` to keep API shapes aligned end-to-end.

## Required skills for this directory

You **must** invoke these skills via the `Skill` tool **before** editing files here. They take priority over generic plugin skills (e.g. `api-and-interface-design`) when working in `packages/shared/`.

| If you're touching… | Invoke skill |
|---|---|
| Any Zod schema in `src/models/`, any exported type, or any validation logic | `cl-error-handling` |
| Email-related schemas (`InviteEmailInputSchema`, `EmailTemplateData`, etc.) | `cl-error-handling` + `cl-adding-email-template` |
| Schemas referenced by oRPC contracts (most schemas here) | `cl-error-handling` + `cl-backend-patterns` |

Schemas here are consumed by both server and client — a breaking change ripples to both apps. Before renaming or removing a field, check who imports it.
