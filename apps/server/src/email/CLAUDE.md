# Email

Transactional email service. Uses Resend for delivery (`client.ts`), React Email components for templates (`components/`, `templates/`), and a typed `send()` API (`send.ts`) wired to schemas in `packages/shared/src/models/email*`.

## Required skills for this directory

You **must** invoke these skills via the `Skill` tool **before** editing files here. They take priority over generic plugin skills (e.g. `incremental-implementation`) when working on email code.

| If you're touching… | Invoke skill |
|---|---|
| Any new template in `templates/`, any change to `send.ts`, or any new email type | `cl-adding-email-template` |
| Email schemas in `packages/shared/src/models/email*` | `cl-adding-email-template` + `cl-error-handling` |
| Backend handler that triggers an email send | `cl-adding-email-template` + `cl-backend-patterns` |

Adding a template requires coordinated changes across shared schemas, the template registry, and the send call — `cl-adding-email-template` walks through all of them. Skipping it usually means a missed registration step that fails silently in production.
