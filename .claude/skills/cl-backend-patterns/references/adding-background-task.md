# Adding a Background or Scheduled Task

## Overview

There are two types of jobs:

- **Background task** — triggered on demand by your code (e.g. API handler enqueues a job when a user signs up)
- **Scheduled task** — runs automatically on a recurring schedule (e.g. "clean up stale sessions every hour")

Both use the same registry pattern. The only difference is whether the job definition includes a `schedule` field.

## Files to Touch

| Step | File | What to do |
|------|------|------------|
| 1 | `apps/server/src/async-tasks/job-registry.ts` | Add queue name to `QUEUES` constant |
| 2 | `apps/server/src/async-tasks/jobs/<name>.job.ts` | Create job handler file |
| 3 | `apps/server/src/async-tasks/jobs/index.ts` | Add import for the new job file |

That's it. No other files need to change. The worker auto-discovers jobs and registers schedulers on startup.

## Step-by-Step

### 1. Add Queue Name (`apps/server/src/async-tasks/job-registry.ts`)

Add a new entry to the `QUEUES` constant. Format: `<DOMAIN>_<ACTION>` key, `"<domain>.<action>"` value.

```typescript
export const QUEUES = {
	SAMPLE_BACKGROUND: "sample.background",
	BILLING_GENERATE_INVOICE: "billing.generate-invoice",  // add here
	SYSTEM_DEAD_LETTER: "system.dead-letter",
} as const;
```

Naming convention: lowercase kebab-case with `<domain>.<action>` format. The domain groups related jobs; the action describes what happens.

### 2. Create Job Handler

#### For a background task (`apps/server/src/async-tasks/jobs/<name>.job.ts`)

```typescript
// apps/server/src/async-tasks/jobs/generate-invoice.job.ts
import { logger } from "../../utils/logger.js";
import { QUEUES, registerJob } from "../job-registry.js";

interface GenerateInvoicePayload {
	userId: string;
	amount: number;
	currency: string;
}

registerJob<GenerateInvoicePayload>({
	queue: QUEUES.BILLING_GENERATE_INVOICE,
	handler: async (job) => {
		logger.info(
			{ userId: job.data.userId, amount: job.data.amount },
			"Generating invoice",
		);

		// Your business logic here
	},
	// Optional: override default worker options for this job
	// workerOptions: { concurrency: 2 },
});
```

#### For a scheduled task (`apps/server/src/async-tasks/jobs/<name>.job.ts`)

Same as above, but add the `schedule` field:

```typescript
// apps/server/src/async-tasks/jobs/cleanup-stale-sessions.job.ts
import { logger } from "../../utils/logger.js";
import { QUEUES, registerJob } from "../job-registry.js";

registerJob({
	queue: QUEUES.CLEANUP_STALE_SESSIONS,
	handler: async () => {
		logger.info("Cleaning up stale sessions");
		// Your cleanup logic here
	},
	schedule: {
		schedulerId: "cleanup-stale-sessions", // unique ID in Redis
		pattern: "0 * * * *",                  // cron pattern: every hour
	},
});
```

The `schedule` field tells the worker to register a BullMQ job scheduler on startup. It auto-enqueues a job on every tick of the cron pattern.

**Common cron patterns:**

| Pattern | Meaning |
|---------|---------|
| `* * * * *` | Every minute |
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour |
| `0 9 * * *` | Daily at 9:00 AM UTC |
| `0 12 * * *` | Daily at 5:00 PM PKT (12:00 UTC) |
| `0 0 * * 0` | Weekly on Sunday at midnight |

File naming convention: `<name>.job.ts` — use a descriptive kebab-case name.

### 3. Register in Barrel (`apps/server/src/async-tasks/jobs/index.ts`)

Add the import so the worker discovers it:

```typescript
import "./dead-letter.job.js";
import "./sample-background.job.js";
import "./generate-invoice.job.js";  // add here
```

### 4. Enqueue a Background Task (from your code)

This step only applies to **background tasks** (not scheduled — those auto-enqueue).

```typescript
import { getQueue, QUEUES } from "../async-tasks/jobs/index.js";

const queue = getQueue(QUEUES.BILLING_GENERATE_INVOICE);
await queue.add("generate-invoice", {
	userId: context.userId,
	amount: 4999,
	currency: "USD",
});
```

### 5. Include requestId for Log Correlation

When dispatching a job from an oRPC handler, always include `requestId` from the handler context. This connects server logs to background job logs via the same ID.

```typescript
import { getQueue, QUEUES } from "../async-tasks/jobs/index.js";

const queue = getQueue(QUEUES.BILLING_GENERATE_INVOICE);
await queue.add("generate-invoice", {
	userId: context.userId,
	requestId: context.requestId, // REQUIRED for log correlation
	amount: 4999,
	currency: "USD",
});
```

The worker automatically reads `requestId` from the job payload and sets up AsyncLocalStorage, so all `logger` calls inside the job handler include it automatically.

For scheduled/cron jobs, `requestId` is not applicable (no originating request). The worker generates a synthetic ID for those.

## Updating a Scheduled Task's Schedule

Just change the `pattern` in the job file and redeploy. The worker calls `upsertJobScheduler` on startup, which overwrites the old schedule in Redis.

## Removing a Scheduled Task

1. Delete the job file
2. Remove its import from `jobs/index.ts`
3. Remove its queue name from `QUEUES`
4. After deploying, remove the orphaned scheduler from Redis:
   ```typescript
   await getQueue(QUEUES.MY_QUEUE).removeJobScheduler("my-scheduler-id");
   ```

## Default Behavior (configured in `job-registry.ts`)

| Setting | Default | Meaning |
|---------|---------|---------|
| Retry attempts | 3 | Job retried up to 3 times on failure |
| Backoff | Exponential, 1s base | Delays: ~1s, ~2s, ~4s between retries |
| Concurrency | 5 per worker | Up to 5 jobs processed in parallel |
| Lock duration | 30 seconds | Job considered stalled if handler takes longer |
| Dead letter queue | Automatic | Jobs that exhaust all retries are logged to `system.dead-letter` |

Override per-job via the `workerOptions` field in `registerJob()`.

## What You DON'T Need To Do

- **No worker configuration** — the worker auto-discovers registered jobs and schedulers
- **No Redis setup** — shared connections are managed in `utils/redis.ts`
- **No retry logic in handlers** — BullMQ handles retries and backoff automatically
- **No DLQ handling** — the worker wrapper pushes permanently failed jobs to the dead letter queue
- **No external cron** — scheduled tasks are managed entirely by BullMQ inside the worker

## Inspecting Queues

The bull-board dashboard is mounted at `/admin/jobs` on the API server (e.g. http://localhost:3000/admin/jobs locally). It shows status counts, job payloads, and error stack traces, and supports retrying or removing failed jobs. Access is gated by a small `requireAdmin` Express middleware in `apps/server/src/index.ts` (Clerk session + `users.role === Roles.ADMIN` + `deletedAt IS NULL`), so non-admins get a 403. For oRPC routes that need the same gate, compose `protectedProcedure.use(requireRole(Roles.ADMIN))` from `apps/server/src/orpc/middleware/require-role.ts`. That's the canonical admin gate inside the RPC layer.

The dashboard auto-discovers all queues in the `QUEUES` constant — no extra wiring needed when you add a new job.

The dashboard is only mounted when `NODE_ENV=development`; it is off in `test`, `staging`, and `production`. Exposing it in any deployed environment requires loosening the `env.NODE_ENV === "development"` check in `apps/server/src/index.ts` after ops sign-off.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgot to add import to `jobs/index.ts` | Job silently never registers. Always add the import |
| Used a string instead of `QUEUES` constant | Typo risk. Always use `QUEUES.MY_QUEUE` |
| Duplicate queue name in `QUEUES` | `registerJob()` throws if a queue is already registered |
| Handler doesn't throw on error | BullMQ only retries if the handler throws. Don't swallow errors silently |
| Used `:` in queue name | BullMQ reserves `:` internally. Use `.` as the separator |
| Cron pattern in wrong timezone | Patterns are UTC. Use `0 12 * * *` for 5:00 PM PKT |
| Forgot `requestId` in job payload | Always include `context.requestId` when dispatching from an oRPC handler |
