# Adding a Database Entity

## Overview

Database entities are defined as Drizzle ORM schemas in TypeScript. The schema is the source of truth — migrations are generated from it. Corresponding Zod schemas in `packages/shared` handle API validation separately.

## Files to Touch

| Step | File | What to do |
|------|------|------------|
| 1 | `apps/server/src/db/schema/<entity>.schema.ts` | Define Drizzle table |
| 2 | `apps/server/src/db/schema/index.ts` | Export the new schema |
| 3 | `packages/shared/src/models/<entity>.types.ts` | Define Zod schemas for API layer |
| 4 | `packages/shared/src/index.ts` | Export Zod schemas |
| 5 | Run `pnpm db:generate` | Generate SQL migration |
| 6 | Run `pnpm db:push` or `pnpm db:migrate` | Apply to database |

## Step-by-Step

### 1. Define Table Schema

Create `apps/server/src/db/schema/tasks.schema.ts`:

```typescript
import { index, pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { users } from "./users.schema";

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    description: text("description"),
    completed: boolean("completed").notNull().default(false),
    userId: text("user_id").notNull().references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("tasks_user_id_idx").on(table.userId)],
);
```

Key patterns:
- Use `text("column_name")` with snake_case DB column names
- Use `.references(() => table.column)` for foreign keys
- Always create an index on FK columns — name: `<table>_<column_snake_case>_idx`
- Always include `createdAt` and `updatedAt` timestamps
- Use `.$defaultFn(() => crypto.randomUUID())` for app-generated IDs. For tables where the ID comes from an external system (e.g., Clerk provides the user ID), use `text("id").primaryKey()` without `.$defaultFn()`
- For JSONB columns: `jsonb("prefs").notNull().$type<MyType>().default({})`

### 2. Export Schema (`apps/server/src/db/schema/index.ts`)

```typescript
export * from "./users.schema";
export * from "./tasks.schema";  // add this
```

This is required — the `db` instance loads all schemas via `import * as schema from "./schema"`.

### 3. Define Zod Schemas (`packages/shared/src/models/`)

These are separate from Drizzle schemas and used for API contracts:

```typescript
// packages/shared/src/models/task.types.ts
import { z } from "zod";

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  completed: z.boolean(),
  userId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type TaskSchema = z.infer<typeof TaskSchema>;

export const CreateTaskInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
});
export type CreateTaskInputSchema = z.infer<typeof CreateTaskInputSchema>;
```

All types and enums used by the entity must be defined here — including status enums, category unions, etc. The shared lib is the single source of truth for types across the stack.

```typescript
// Example: enum/union types go in the shared model file
export const TaskStatus = z.enum(["pending", "in_progress", "completed"]);
export type TaskStatus = z.infer<typeof TaskStatus>;
```

Then in the Drizzle schema, import and use the type:
```typescript
import type { TaskStatus } from "@repo/shared";

// In the table definition:
status: text("status").notNull().$type<TaskStatus>().default("pending"),
```

Export from `packages/shared/src/index.ts`.

### 4. Generate and Apply Migration

```bash
pnpm db:generate    # generates SQL in apps/server/src/db/migrations/
pnpm db:push        # pushes schema directly (dev) — OR —
pnpm db:migrate     # runs migration files (production)
```

Review the generated SQL before applying.

## Querying Entities

### Basic CRUD

```typescript
import { eq } from "drizzle-orm";
import { db } from "../../db/db";
import { tasks } from "../../db";

// Find one
const task = await db.query.tasks.findFirst({
  where: eq(tasks.id, taskId),
});

// Find many
const allTasks = await db.query.tasks.findMany({
  where: eq(tasks.userId, userId),
});

// Insert
const [created] = await db.insert(tasks).values({ title, userId }).returning();

// Update
const [updated] = await db
  .update(tasks)
  .set({ completed: true, updatedAt: new Date() })
  .where(eq(tasks.id, taskId))
  .returning();

// Delete
await db.delete(tasks).where(eq(tasks.id, taskId));

// Soft delete (when entity uses deletedAt column)
await db.update(tasks).set({ deletedAt: new Date() }).where(eq(tasks.id, taskId));
```

### Operators

```typescript
import { eq, and, or, inArray, isNull } from "drizzle-orm";

where: and(eq(tasks.userId, userId), isNull(tasks.deletedAt))  // soft-delete filter
where: or(eq(tasks.status, "open"), eq(tasks.status, "in_progress"))
where: inArray(users.id, userIds)
```

### Column Selection

```typescript
const user = await db.query.users.findFirst({
  where: eq(users.id, userId),
  columns: { id: true, email: true, name: true },
});
```

### Conflict Handling

Use `.onConflictDoNothing()` for idempotent inserts:

```typescript
await db.insert(users).values({ id, email, name }).onConflictDoNothing();
```

### Transactions

Wrap multi-table mutations in a transaction. Use `tx` (not `db`) inside the callback — if any statement throws, the entire transaction rolls back:

```typescript
const result = await db.transaction(async (tx) => {
  const [project] = await tx.insert(projects).values({ name }).returning();
  await tx.insert(memberships).values({ projectId: project.id, userId });
  return project;
});
```

### Relations

When you need to query across related tables, define Drizzle relations in the schema file and use `with:` in queries:

```typescript
// In the schema file, after the table definition:
import { relations } from "drizzle-orm";

export const tasksRelations = relations(tasks, ({ one }) => ({
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
}));

// In the service:
const taskWithUser = await db.query.tasks.findFirst({
  where: eq(tasks.id, taskId),
  with: { user: true },
});
```

Relations must be exported from `schema/index.ts` alongside their table — the `db` instance loads all exports via `import * as schema from "./schema"`.

### Pagination

Use `limit` and `offset` with `findMany` for paginated queries:

```typescript
const page = await db.query.tasks.findMany({
  where: eq(tasks.userId, userId),
  limit: pageSize,
  offset: (page - 1) * pageSize,
  orderBy: (tasks, { desc }) => [desc(tasks.createdAt)],
});
```

## JSONB Columns

For structured JSON data, use `jsonb()` with `.$type<T>()` for TypeScript type safety. The type parameter doesn't affect the database — it tells TypeScript what shape to expect:

```typescript
import type { UserPreferences } from "@repo/shared";

preferences: jsonb("preferences")
  .notNull()
  .$type<UserPreferences>()
  .default({}),
```

Define the type as a Zod schema in `packages/shared/src/models/` and import the inferred type here.

For extensible objects (where unknown keys should be allowed through), use `z.looseObject()` instead of `z.object()` — this is a Zod 4 feature used in the codebase for types like `UserPreferences` that may grow over time without breaking existing consumers.

## Column Type Quick Reference

| Need | Drizzle Column |
|------|---------------|
| String | `text("name")` |
| Integer | `integer("count")` |
| Boolean | `boolean("active")` |
| Timestamp | `timestamp("created_at")` |
| JSON object | `jsonb("metadata").$type<MyType>()` |
| UUID (auto) | `text("id").primaryKey().$defaultFn(() => crypto.randomUUID())` |
| Foreign key | `text("user_id").references(() => users.id)` |
| Enum | `text("status").$type<TaskStatus>()` (import type from `@repo/shared`) |

## What You DON'T Need To Do

- **No raw SQL for table creation** — Drizzle generates migrations from TypeScript
- **No ORM model classes** — Drizzle uses plain table definitions, not classes
- **No separate migration files by hand** — `pnpm db:generate` creates them
- **No Zod-to-Drizzle sync** — they're intentionally separate (DB schema vs API validation)

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgot to export from `schema/index.ts` | Drizzle queries won't find the table. Must be in barrel export |
| Used camelCase for DB column names | Convention is snake_case in DB: `text("user_id")` not `text("userId")` |
| Forgot `updatedAt` manual update | Drizzle doesn't auto-update. Set `updatedAt: new Date()` in `.set()` calls |
| Skipped `pnpm db:generate` after schema change | Database won't match TypeScript. Always generate + apply |
| Defined types/enums in the Drizzle schema file | Types and enums belong in `packages/shared/src/models/`. Import them in the Drizzle schema via `@repo/shared` |
