# Adding Middleware

## Overview

There are two middleware layers: **Express middleware** (runs on every HTTP request) and **oRPC procedure middleware** (runs on specific RPC endpoints). Choose based on scope.

## Express Middleware (Global HTTP)

For middleware that applies to all HTTP requests (rate limiting, headers, body parsing, etc.).

### Where to Add

Add directly in `apps/server/src/index.ts` (there is no separate middleware directory). **Order matters:**

```typescript
// Current order:
app.use(pinoHttp({ logger, genReqId }));          // 1. Request logging + request ID generation
app.use(alsMiddleware);                            // 2. AsyncLocalStorage context (uses req.id from step 1)
app.use(cors({ origin: env.CORS_ORIGIN, ... }));  // 3. CORS
app.use(clerkMiddleware());                        // 4. Auth context
// Add new middleware here                         // 5. Your middleware
// ... then oRPC handler                          // 6. RPC routing
// ... then global error handler                  // 7. Error catch-all
```

### Example: Rate Limiting

```typescript
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use(limiter);  // Add before oRPC handler
```

### Example: Custom Header

```typescript
app.use((req, res, next) => {
  res.setHeader("X-Request-Id", crypto.randomUUID());
  next();
});
```

## oRPC Procedure Middleware (RPC-Level)

For middleware that applies to specific endpoints or groups of endpoints (auth checks, data enrichment, permission guards).

### Where to Add

In `apps/server/src/orpc/procedures.ts`. Chain `.use()` on an existing procedure:

### Example: New Protected Procedure with Extra Checks

```typescript
export const adminProcedure = protectedProcedure.use(async ({ context, next }) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, context.userId),
    columns: { isAppAdmin: true },
  });

  if (!user?.isAppAdmin) {
    throw new ORPCError("FORBIDDEN", { message: "Admin access required" });
  }

  return next({ context: { userId: context.userId, isAdmin: true } });
});
```

Then use in controllers the same way as `protectedProcedure` — the procedure chain must still follow the contract path:

```typescript
export const userController = {
  deleteUser: adminProcedure.user.deleteUser.handler(async ({ context, input }) => {
    // context.isAdmin is true here
  }),
};
```

### Existing Procedure Chain

```
publicProcedure          — no auth, just contract binding
  └─ protectedProcedure  — checks userId, auto-creates user in DB
      └─ adminProcedure  — (example) checks isAppAdmin flag
```

Each level adds middleware via `.use()` and can extend `context`.

## When to Use Which

| Need | Layer |
|------|-------|
| Rate limiting | Express |
| CORS / headers | Express |
| Request logging | Express |
| Body parsing | Express |
| Auth check (has valid token?) | Express (Clerk middleware) |
| Auth guard (is authenticated?) | oRPC procedure (`protectedProcedure`) |
| Permission check (is admin?) | oRPC procedure (custom) |
| Data enrichment (load user profile) | oRPC procedure |
| Input validation | Neither — oRPC contracts handle this |

## What You DON'T Need To Do

- **No input validation middleware** — oRPC validates from contract schemas
- **No error formatting middleware** — oRPC serializes `ORPCError` automatically
- **No auth token parsing** — Clerk middleware + `createAuthContext` handle this
- **No response wrapping** — oRPC handles serialization

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Adding Express middleware after the oRPC handler | It won't run for RPC requests. Add before the handler |
| Duplicating auth checks in Express and oRPC | Use Clerk middleware for token parsing, `protectedProcedure` for auth guard |
| Not calling `next()` in Express middleware | Request hangs. Always call `next()` or send a response |
| Not calling `return next({ context })` in oRPC middleware | Handler never executes. Always return `next()` |
| Forgetting to extend context in `.use()` | New context fields won't be available downstream |
