# Logging Conventions

## The Logger

Import `logger` from `utils/logger`. It auto-includes `requestId` within HTTP requests and BullMQ jobs via AsyncLocalStorage. No manual context passing needed.

```typescript
import { logger } from "../../utils/logger";

logger.info("Doing something");
// Inside a request: { requestId: "abc-123", msg: "Doing something" }
// Outside a request: { msg: "Doing something" }
```

## Rules

1. **Always use `logger`** — never `console.log`. Pino outputs structured JSON in production.
2. **Don't pass requestId manually** — the mixin handles it. Just call `logger.info(...)`.
3. **Always include requestId when dispatching BullMQ jobs** — AsyncLocalStorage doesn't cross process boundaries:
   ```typescript
   await queue.add("job-name", {
     ...payload,
     requestId: context.requestId,
   });
   ```
4. **Add domain-specific context as the first argument** when useful:
   ```typescript
   logger.info({ userId, email }, "Sending invite");
   ```
5. **Use appropriate log levels:**
   - `logger.error()` — something broke (exceptions, failed operations)
   - `logger.warn()` — something unexpected but recoverable
   - `logger.info()` — normal operations worth recording
   - `logger.debug()` — detailed info for debugging (off in production by default)

## Request Context

The `requestId` is available in oRPC handler context for explicit use:

```typescript
// context.requestId — use for job dispatch or including in external API calls
// context.userId — from Clerk auth
```

## Standard Fields

| Field | Auto-included | Source |
|-------|--------------|--------|
| `requestId` | Yes (in request/job) | AsyncLocalStorage mixin |
| `jobId` | Yes (in jobs) | AsyncLocalStorage mixin |
| `queue` | Yes (in jobs) | AsyncLocalStorage mixin |
