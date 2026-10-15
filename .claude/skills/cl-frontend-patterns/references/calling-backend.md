# Calling a Backend Endpoint from the Frontend

## Overview

The frontend uses an oRPC client (`apps/web/src/utils/orpc.ts`) integrated with TanStack Query. Auth tokens are attached automatically via Clerk. You write a custom hook in `src/api/` that wraps `orpc.<domain>.<method>`.

## Files to Touch

| File | What to do |
|------|------------|
| `apps/web/src/api/<domain>.api.ts` | Create hook using `orpc` + TanStack Query |
| Your page/component | Import and use the hook |

## For Mutations (create, update, delete)

Create a hook in `apps/web/src/api/<domain>.api.ts`:

```typescript
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "../utils/orpc";

export function useCreateTask({ onSuccess }: { onSuccess: (data: CreateTaskResultSchema) => void }) {
  return useMutation(
    orpc.task.create.mutationOptions({
      onSuccess: (data) => {
        onSuccess(data);
        toast.success("Task created!");
      },
    }),
  );
}
```

> **Error handling:** Do NOT add `onError` just for error toasts — the global `MutationCache` in `tanstack-query.ts` already shows a toast for all mutation errors. Only add `onError` if you need custom side effects (e.g., reset form state, clear a field). Note: if you do define `onError`, **both** the global handler and your hook's handler will fire — so don't add a duplicate toast.

Use in a component:

```tsx
const createTask = useCreateTask({ onSuccess: () => router.push("/portal/tasks") });

// Trigger mutation
createTask.mutate({ title: "My task", description: "Details" });

// Loading state
createTask.isPending
```

## For Queries (read, list)

The pattern mirrors mutations but uses `useQuery` + `queryOptions()`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { orpc } from "../utils/orpc";

// Example: if you had a task domain with a list endpoint
export function useTaskList() {
  return useQuery(orpc.task.list.queryOptions());
}
```

Use in a component:

```tsx
const { data: tasks, isLoading, error } = useTaskList();
```

> **Note:** For user identity/profile data (name, email, avatar), use Clerk's `useUser()` hook — not an oRPC query. oRPC queries are for application data stored in your database.

## Hook Naming Convention

Hooks live in `apps/web/src/api/` with descriptive file names:

| Pattern | Example |
|---------|---------|
| `use<Action><Entity>` | `useCreateTask`, `useInviteEmail` |
| `use<Entity>List` | `useTaskList` |
| `useCurrent<Entity>` | `useCurrentUser` |
| File name: `<domain>.api.ts` | `task.api.ts`, `email.api.ts` |

## What You DON'T Need To Do

- **No auth token handling** — the oRPC client attaches Clerk JWT automatically
- **No base URL configuration** — configured once in `orpc.ts` via `NEXT_PUBLIC_SERVER_URL`
- **No type imports** — types flow from contracts automatically; `data` is fully typed
- **No `fetch` or `axios` calls** — oRPC handles transport
- **No error response parsing** — TanStack Query + oRPC handle error objects
- **No query client provider setup** — already configured in `providers.tsx`
- **No query invalidation on error** — global error handler in `tanstack-query.ts` shows retry toast
- **No `onError` toasts in hooks** — global `MutationCache` and `QueryCache` handle error toasts automatically

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using `useQuery` for a write operation | Use `useMutation` for create/update/delete |
| Putting hooks in `hooks/` or colocating with pages | Use `src/api/<domain>.api.ts` |
| Manually fetching with `fetch`/`axios` | Use `orpc.<domain>.<method>` for type safety |
| Adding `onError` with `toast.error()` in hooks | Don't — global `MutationCache`/`QueryCache` already shows error toasts. Only use `onError` for custom side effects (reset state, clear fields) |
