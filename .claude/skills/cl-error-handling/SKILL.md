---
name: cl-error-handling
description: Error handling and input validation conventions for the full stack using oRPC + Zod. Use when creating, modifying, or reviewing error handling, throwing ORPCError, Zod schemas, validation logic, form errors, or shared models in packages/shared/. Trigger when the user says things like "throw an error", "validation failed", "form errors", "handle this error", "add validation for X", "why is this failing", or when touching anything that imports ORPCError, ZodError, or files in packages/shared/src/models/. You must invoke this skill before adding any new error or validator — error codes, status mapping, and frontend display all need to stay aligned.
allowed-tools: Read, Grep, Glob, Write, Edit
---

# Error Handling

## oRPC Error Model

Errors use oRPC's built-in `ORPCError` class, which maps to standard error codes. This replaces custom error classes — no `ApiError` or RFC 9457 wrappers needed.

```typescript
import { ORPCError } from "@orpc/server";

throw new ORPCError("NOT_FOUND", { message: "User not found" });
```

### Available Error Codes

| Code | HTTP Status | When to use |
|------|------------|-------------|
| `"BAD_REQUEST"` | 400 | Invalid input (rare — contract validation handles most) |
| `"UNAUTHORIZED"` | 401 | Not authenticated |
| `"FORBIDDEN"` | 403 | Authenticated but not permitted |
| `"NOT_FOUND"` | 404 | Resource doesn't exist |
| `"CONFLICT"` | 409 | Duplicate or state conflict |
| `"INTERNAL_SERVER_ERROR"` | 500 | Unexpected failures |

### When to use `ORPCError` vs plain `Error`

- **`ORPCError`** — for business logic errors that should reach the client (not found, unauthorized, conflict, etc.). Always pass `{ message: "..." }` as the second argument — this is the string that surfaces as `error.message` on the frontend.
- **Plain `Error`** — for configuration or infrastructure failures that shouldn't be surfaced to the client (e.g., missing API key, failed email transport). These are caught by the global Express error handler and logged as 500s.

### Error messages

Messages should be short, human-readable, and safe to display in the UI. No stack traces, internal IDs, or technical jargon. Examples from the codebase: `"User not found"`, `"Authentication required"`.

### Backend Error Flow

1. **Contract validation** — oRPC validates input against the contract's `.input()` Zod schema automatically. Invalid input is rejected before your handler runs.
2. **`protectedProcedure` handles auth** — It throws `ORPCError("UNAUTHORIZED")` automatically if there's no authenticated user. Don't add redundant auth checks in services — if a handler uses `protectedProcedure`, `context.userId` is guaranteed to exist.
3. **Service errors** — Services throw `ORPCError` with a descriptive message. This is the primary error mechanism.
4. **oRPC serialization** — oRPC catches the error and sends it to the client with the appropriate HTTP status code. The `message` from `ORPCError` becomes `error.message` on the frontend.
5. **Global interceptor** — The oRPC `onError` interceptor in `apps/server/src/index.ts` logs all RPC errors via Pino and reports 5xx errors to Rollbar (if configured). A fallback Express error handler catches any non-oRPC errors, logs them, reports to Rollbar, and returns a generic 500.

See `/cl-backend-patterns` for a full service example with error throwing.

### Frontend Error Flow

1. **oRPC client** catches errors from the server and surfaces them as `ORPCError` objects with the message from the server.
2. **Global QueryCache handler** — `apps/web/src/utils/tanstack-query.ts` shows a toast with a retry button for all **query** errors automatically. You don't need to add error toasts in individual query hooks.
3. **Global MutationCache handler** — shows a toast for all **mutation** errors automatically. You don't need to add `onError` toasts in individual mutation hooks.
4. **Smart retry** — queries auto-retry up to 3 times with exponential backoff (1s → 2s → 4s) for transient errors (`INTERNAL_SERVER_ERROR`, `BAD_GATEWAY`, `SERVICE_UNAVAILABLE`, `GATEWAY_TIMEOUT`, `TIMEOUT`, `TOO_MANY_REQUESTS`). Client errors (401, 403, 404, etc.) fail immediately. Mutations do NOT retry.
5. **TanStack Query** catches the error automatically — components access it via the `error` field.
6. **Hook-level handling** — only add `onSuccess` for success toasts. Do NOT add `onError` just for error toasts (the global handler does it):

```typescript
export function useInviteEmail({ onSuccess }) {
	return useMutation(
		orpc.email.invite.mutationOptions({
			onSuccess: (data) => {
				onSuccess(data);
				toast.success("Invite email sent successfully!");
			},
		}),
	);
}
```

> **Important:** If you add a custom `onError` in a hook, **both** the global MutationCache/QueryCache handler AND your hook's `onError` will fire. Only use `onError` for custom side effects (reset form state, clear fields) — never for duplicate error toasts.

Components consume error state from hooks — no component-level try/catch for API calls:

```typescript
const { data, error, isLoading } = useMyQuery();
if (error) return <p className="text-destructive">{error.message}</p>;
```

## Input Validation

Zod is the single validation tool across the entire stack. Schemas are defined once in `packages/shared/src/models/` and used everywhere.

### Where schemas live

- **`packages/shared/src/models/`** — Zod schemas and inferred TypeScript types. One file per domain (e.g., `user.types.ts`, `email.types.ts`).
- **`packages/orpc-contracts/src/contracts/`** — Contracts reference these schemas via `.input()` and `.output()`.

### Validation flow

- **Backend**: oRPC validates input against the contract schema before the handler runs. No manual parsing needed — if the handler executes, the input is already valid and typed.
- **Frontend forms**: TanStack Form validates against the same Zod schema on the client side (see `/cl-frontend-patterns` → `references/creating-forms.md`).
- **Frontend responses**: oRPC client validates responses against the contract's output schema automatically.

### Schema naming conventions

| What | Convention | Example |
|------|-----------|---------|
| Domain model | `<Domain>Schema` | `UserSchema` |
| Nested object | descriptive name | `UserPreferences` |
| Input for endpoint | `<Action><Domain>InputSchema` | `InviteEmailInputSchema` |
| Result from endpoint | `<Action><Domain>ResultSchema` | `InviteEmailSendResultSchema` |
| Inferred types | same name as the const (TypeScript merges them) | `UserSchema`, `InviteEmailInputSchema` |
