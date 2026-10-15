---
name: cl-backend-patterns
description: Backend conventions for Express 5 + oRPC + Drizzle in apps/server/. **Applies to ANY file in apps/server/** — not only the business-logic layer. This includes controllers, services, oRPC handlers, Drizzle entities, migrations, middleware, BullMQ jobs, *and also* utilities (apps/server/src/utils/*), monitoring, error tracking (Rollbar, Sentry), logging, external service integrations, bootstrap code, and auth glue. Examples are illustrative, not exhaustive — if the file lives under apps/server/ and it's not pure text/config, invoke this skill. Trigger on user phrases like "add an endpoint", "new oRPC procedure", "add a table", "create a migration", "wire up Sentry on the server", "add a job", "integrate X service on the backend", "add a server utility", or anything that touches apps/server/src/. You must invoke this skill before writing or modifying backend code. Many tasks need multiple skills at once — e.g. integrating a new service typically needs this skill *plus* cl-adding-environment-variable *plus* any service-specific plugin skill. Invoke all that apply; don't stop at the first match. This skill takes priority over generic plugin skills like incremental-implementation or api-and-interface-design when the work is inside apps/server/.
allowed-tools: Read, Grep, Glob, Write, Edit, Bash
---

# Backend Patterns

Standard patterns for all new backend code. Existing code may not yet conform — migrate as you touch it.

## Architecture

Two-layer separation in `apps/server/src/controllers/`:

**Data flow:** oRPC Contract → Controller (handler wiring) → Service (business logic + DB) → Database

```
orpc/              → oRPC setup (procedures, auth context)
  procedures.ts    → publicProcedure & protectedProcedure definitions
  auth-context.ts  → Creates { userId, requestId } context from Clerk auth + request
controllers/       → oRPC handler definitions (wire contract methods to service calls)
  <domain>/
    <domain>.controller.ts  → Handler objects mapping contract methods to service functions
    <domain>.service.ts     → Business logic + database access
controllers/index.ts        → Assembles appRouter from all controllers
```

The oRPC contract (in `packages/orpc-contracts/`) defines the API surface. The controller implements it. The service does the actual work.

Procedures are created in `orpc/procedures.ts` via `implement(appContract).$context<AuthContext>()`, which binds the contract to the server and establishes the context type. This is the root of the type chain — if procedure handler types break, start debugging here.

## Controllers (`controllers/<domain>/`)

Controllers wire oRPC contract methods to service functions. They are thin — extract context/input, call the service, return the result.

One controller + service pair per domain (e.g., `user/`, `email/`).

**Pattern:**
- Use `protectedProcedure` for authenticated endpoints, `publicProcedure` for open ones
- The handler receives `{ context, input }` — context has `userId` (from auth) and `requestId` (for BullMQ job dispatch), input is already validated by the contract's Zod schema
- No manual input parsing needed — oRPC validates against the contract's `.input()` schema automatically
- Return the result directly — oRPC validates it against the contract's `.output()` schema

For the full step-by-step (contract → schema → service → controller → router), read `references/adding-endpoint.md`.

## Services (`controllers/<domain>/`)

Business logic and database access. One service file per domain, co-located with its controller.

- Import `db` from `db/db` and schema tables from the `db/` barrel (`db/index.ts` re-exports both the db instance and all schema exports)
- Throw errors using `ORPCError` from `@orpc/server` — e.g., `throw new ORPCError("NOT_FOUND", { message: "User not found" })`. See `/cl-error-handling` for codes and conventions.
- Return Drizzle rows directly — no mapper layer. The contract's `.output()` schema defines the shape; oRPC validates it automatically.
- For service-level logging, import `logger` from `utils/logger` (Pino). RPC errors are already logged automatically by the error interceptor in `index.ts`.

### Service Function Signatures

Use **primitive arguments** for single-purpose lookups and **the contract input type** for mutations or multi-field inputs:

```typescript
// Primitives for lookups — clear and simple
export async function getUserById(userId: string) { ... }

// Input object for mutations — matches contract schema
export async function updateUserPreferences(userId: string, input: UserPreferences) { ... }
```

## Database Conventions

- **Soft delete**: When creating a new entity, ask the user whether it should support soft delete. If yes, add a `deletedAt` column and always filter with `isNull(table.deletedAt)` in service queries.
- **Foreign keys**: Confirm with the user regarding nullability and referential action. Default: nullable + `onDelete: "set null"`. Always index FK columns.

For step-by-step entity creation (table definition, Zod schemas, migrations) and all query patterns (CRUD, operators, transactions, relations, pagination), read `references/adding-entity.md`.

## Logging

All logging uses `logger` from `utils/logger` (Pino). Within HTTP requests and BullMQ jobs, `requestId` is auto-included in every log line via AsyncLocalStorage — no manual passing needed.

- Import `logger` from `utils/logger` — never use `console.log`
- Add domain-specific context as the first argument: `logger.info({ userId }, "msg")`
- When dispatching BullMQ jobs, always include `requestId: context.requestId` in the payload

For full conventions and examples, read `references/logging.reference.md`.

## Reference Guides

Read these when performing the specific task:

- `references/adding-endpoint.md` — Step-by-step for adding contracts, schemas, services, controllers, and router registration
- `references/adding-entity.md` — Step-by-step for adding Drizzle tables, Zod schemas, migrations, and all query patterns
- `references/adding-middleware.md` — Express and oRPC procedure middleware patterns
- `references/adding-background-task.md` — Adding background jobs and scheduled tasks with BullMQ
- `references/logging.reference.md` — Logging conventions, log levels, and request context

## Related Skills

- `/cl-error-handling` — Error codes, ORPCError usage, validation flow, and schema naming conventions
- `/cl-adding-environment-variable` — Adding env vars with t3-env validation
- `/cl-adding-email-template` — Full email pipeline (template → contract → service → frontend hook)
