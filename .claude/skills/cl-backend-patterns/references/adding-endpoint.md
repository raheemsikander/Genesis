# Adding an oRPC Endpoint

## Overview

Endpoints follow a contract-first pattern: define the API surface in shared contracts, implement handlers on the server, consume from the frontend. oRPC handles input/output validation automatically from Zod schemas — no manual validation needed in handlers.

## Files to Touch

| Step | File | What to do |
|------|------|------------|
| 1 | `packages/shared/src/models/<domain>.types.ts` | Define Zod schemas for input/output |
| 2 | `packages/shared/src/index.ts` | Export schemas |
| 3 | `packages/orpc-contracts/src/contracts/<domain>.contract.ts` | Define contract with input/output |
| 4 | `packages/orpc-contracts/src/contracts/index.ts` | Add to `appContract` |
| 5 | `apps/server/src/controllers/<domain>/<domain>.service.ts` | Business logic |
| 6 | `apps/server/src/controllers/<domain>/<domain>.controller.ts` | Handler binding |
| 7 | `apps/server/src/controllers/index.ts` | Add to `appRouter` |

## New Domain vs Existing Domain

**Adding to an existing domain** (e.g., a new method on `userContract`): skip steps 3-4 in the table — just add the method to the existing contract, service, and controller files.

**Creating a new domain** (e.g., `task`): follow all steps — you'll create new contract, service, and controller files, and register the domain in both `appContract` and `appRouter`.

## Step-by-Step

### 1. Define Shared Schemas (`packages/shared/src/models/`)

```typescript
// packages/shared/src/models/task.types.ts
import { z } from "zod";

export const CreateTaskInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
});
export type CreateTaskInputSchema = z.infer<typeof CreateTaskInputSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  createdAt: z.date(),
});
export type TaskSchema = z.infer<typeof TaskSchema>;
```

Naming convention: `<Action><Entity><Input|Result>Schema` — e.g. `CreateTaskInputSchema`, `TaskSchema`. Both the `const` and `type` share the same name.

Export from `packages/shared/src/index.ts`:
```typescript
export * from "./models/task.types";
```

### 2. Define Contract (`packages/orpc-contracts/src/contracts/`)

```typescript
// packages/orpc-contracts/src/contracts/task.contract.ts
import { CreateTaskInputSchema, TaskSchema } from "@repo/shared";
import { oc } from "@orpc/contract";

export const taskContract = {
  create: oc.input(CreateTaskInputSchema).output(TaskSchema),
  list: oc.output(TaskSchema.array()),
};
```

Register in `packages/orpc-contracts/src/contracts/index.ts`:
```typescript
export const appContract = {
  email: emailContract,
  user: userContract,
  task: taskContract,  // add here
};
```

### 3. Implement Service (`apps/server/src/controllers/<domain>/`)

```typescript
// apps/server/src/controllers/task/task.service.ts
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { db } from "../../db/db";
import { tasks } from "../../db";

export async function createTask(userId: string, input: { title: string; description?: string }) {
  const [task] = await db.insert(tasks).values({
    title: input.title,
    description: input.description ?? null,
    userId,
  }).returning();
  return task;
}

export async function listTasks(userId: string) {
  return db.query.tasks.findMany({
    where: eq(tasks.userId, userId),
  });
}
```

### 4. Implement Controller

```typescript
// apps/server/src/controllers/task/task.controller.ts
import { protectedProcedure } from "../../orpc/procedures";
import { createTask, listTasks } from "./task.service";

export const taskController = {
  create: protectedProcedure.task.create.handler(async ({ context, input }) => {
    return createTask(context.userId, input);
  }),
  list: protectedProcedure.task.list.handler(async ({ context }) => {
    return listTasks(context.userId);
  }),
};
```

Key pattern: `protectedProcedure.<domain>.<method>.handler(...)` — the chain must match the contract path.

### 5. Register in Router (`apps/server/src/controllers/index.ts`)

```typescript
import { taskController } from "./task/task.controller";

export const appRouter = {
  email: emailController,
  user: userController,
  task: taskController,  // add here
};
```

## Procedures

Use `protectedProcedure` for authenticated endpoints (provides `context.userId`), `publicProcedure` for open ones. For custom procedure middleware (e.g. admin guards), see `references/adding-middleware.md`.

## What You DON'T Need To Do

- **No input validation in handlers** — oRPC validates against contract schemas automatically before your handler runs
- **No output validation in handlers** — oRPC validates the return value against the output schema
- **No manual error serialization** — throw `ORPCError` and oRPC serializes it
- **No route registration in Express** — the oRPC handler picks up all routes from `appRouter`
- **No OpenAPI spec updates** — generated automatically from contracts (dev mode at `/api-reference`)
- **No type imports on the frontend** — types flow automatically from contracts to the oRPC client

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Handler chain doesn't match contract path | `protectedProcedure.task.create` must match `appContract.task.create` |
| Forgot to add to `appContract` | TypeScript error in procedures. Contract must come first |
| Forgot to add to `appRouter` | Endpoint exists in contract but 404s at runtime |
| Manual input validation in handler | Redundant — oRPC does this. Only validate business rules |
| Using `publicProcedure` for auth-required endpoint | No `context.userId`. Use `protectedProcedure` |
