# Adding an Unprotected Frontend Route

## Overview

Two changes are required to add a public route: register it in the Clerk middleware and create the page file. Missing the middleware step causes Clerk to redirect unauthenticated users to sign-in.

## Steps

### 1. Register the route as public in Clerk middleware

**File:** `apps/web/src/proxy.ts`

Add your route pattern to the `isPublicRoute` matcher array:

```ts
const isPublicRoute = createRouteMatcher([
  "/",
  "/your-route",       // <-- add here (exact match for single page)
  "/your-route(.*)",   // <-- use this pattern if the route has sub-routes
  "/sign-in(.*)",
  "/sign-up(.*)",
]);
```

- Use exact string `"/pricing"` for a single page
- Use glob pattern `"/blog(.*)"` if the route has sub-pages (e.g. `/blog/post-slug`)

### 2. Create the page file

**File:** `apps/web/src/app/<route-name>/page.tsx`

Choose server or client component:

- **Server component** (default, preferred for static content): no directive needed
- **Client component**: add `"use client"` if the page uses hooks (`useState`, `useAuth`, etc.)

Follow the existing landing page patterns — use semantic design tokens (`bg-background`, `text-foreground`, etc.) and `@repo/ui` imports (`buttonVariants`, `cn`).

### 3. (Optional) Add navigation link

If the page should be discoverable from the landing page or elsewhere, add a `<Link>` to the appropriate component.

## What You Do NOT Need

- **No `layout.tsx`** in the new route directory — the root layout already provides `ClerkProvider` and `Providers`
- **No `next.config.ts` changes** — App Router auto-discovers new directories
- **No server/API changes** — purely frontend unless the page needs data

## Common Mistakes

| Mistake | Result |
|---------|--------|
| Forget to update `proxy.ts` | Unauthenticated users get redirected to sign-in |
| Use glob pattern for single page | Works but is overly permissive |
| Add `"use client"` unnecessarily | Loses SSR/SEO benefits for static content |
