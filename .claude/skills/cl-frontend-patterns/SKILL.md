---
name: cl-frontend-patterns
description: Frontend conventions for Next.js App Router + oRPC + TanStack Query/Form in apps/web/. **Applies to ANY file in apps/web/** — not only pages and components. This includes pages, layouts, components, TanStack Query hooks, forms, routes (protected + public), oRPC client calls, *and also* providers, error boundaries, middleware, utilities (apps/web/src/utils/*), client-side monitoring/error-tracking setup, loading/suspense UI, and auth glue. Examples are illustrative, not exhaustive — if the file lives under apps/web/ and it's not pure text/config, invoke this skill. Trigger on user phrases like "add a page", "build this component", "wire up the dashboard", "call the backend from the frontend", "add a form", "make this route public", "set up Rollbar/Sentry on the client", "add a provider", "add a client utility", or anything that touches apps/web/src/. You must invoke this skill before writing or modifying frontend code. Many tasks need multiple skills at once — e.g. integrating a new service typically needs this skill *plus* cl-adding-environment-variable *plus* any service-specific plugin skill. Invoke all that apply; don't stop at the first match. This skill takes priority over generic plugin skills like incremental-implementation or frontend-ui-engineering when the work is inside apps/web/.
---

# Frontend Patterns

Standard patterns for all new frontend code. Existing code may not yet conform — migrate as you touch it.

## Components

Components live in `apps/web/src/components/`:

- UI primitives come from `@repo/ui/components/*` (`@base-ui/react` headless primitives, added via `pnpm ui:add <component>`). Don't create a local `components/ui/` — import directly from the package.
- Currently flat files (e.g., `app-sidebar.tsx`, `base-layout.tsx`). Graduate to `components/<feature>/` folders as feature complexity grows.

See `/cl-design-agent` for component selection, variants, and visual consistency.

**Naming:**

- kebab-case filenames, PascalCase exports: `app-sidebar.tsx` exports `AppSidebar`
- Start as a single file, graduate to a folder when complexity grows

**State management:**

- `useState` for local UI state (loading flags, toggles, non-form ephemeral state)
- **TanStack Form** for all form state — never use multiple `useState` variables for form fields, field errors, and submission state. See the Forms section below.
- TanStack Query for server state (API data, loading, errors)
- React Context wrapped in custom hooks for shared state (`useSidebarControl()`)
- Derive state from existing state whenever possible instead of declaring new state

### Container / Presentation Pattern

Route (page) components act as containers — they own state, fetch data, and handle logic. They pass data down to presentation components via props and receive user intent via `on`-prefixed callbacks.

- The route/page file (`page.tsx`) is the container
- Max component nesting depth: 3 levels — deeper nesting signals a component is doing too much and should be split
- Presentation components define explicit props for data and `on` callbacks for events
- The container is the only component that knows about APIs, contexts, and side effects — this keeps presentation components testable and reusable across different data sources

```
page.tsx (container — data + orchestration)
├── TaskList (presents a list, fires onSelect)
│   └── TaskCard (presents one item, fires onEdit/onDelete)
```

### Component Checklist

Verify before considering a component done:

- [ ] One clear responsibility?
- [ ] Narrow, self-documenting props interface?
- [ ] Data flows down (props), intent flows up (callbacks)?
- [ ] Empty, loading, error, and overflow states handled?
- [ ] Deletable without breaking unrelated parts of the app?
- [ ] Works on 375px mobile and scales up gracefully to desktop?

## API Communication

The frontend communicates with the backend through oRPC + TanStack Query hooks. Read `references/calling-backend.md` when adding a new API hook or wiring a component to a backend endpoint.

**Architecture:**

```
Component → useQuery/useMutation hook (from api/*.ts) → orpc client → server
```

**Rules:**
- One hook file per domain in `apps/web/src/api/` (e.g., `email.api.ts`) — keeps API surface organized and discoverable
- Components only import hooks from `api/*.ts` — never import `orpc` directly in components. This encapsulates transport details and ensures consistent error/success handling
- Hook naming and examples: see `references/calling-backend.md`
- Handle success/error in the hook with toasts (sonner), pass custom callbacks via options
- Components consume `data`, `error`, `isLoading`, `isPending` from hooks — no local `useState` mirrors for request state

## Forms

**Every form must use TanStack Form** (`useForm` from `@tanstack/react-form`) with Zod schema validation. This applies to all forms — whether backed by an oRPC mutation or a client-only flow like Clerk auth pages.

**Do NOT** use multiple `useState` variables for form fields, field-level errors, touched/submitted flags, and mismatch checks. TanStack Form manages all of this. The only `useState` allowed alongside a form is for non-field UI state (e.g., a loading flag for an OAuth redirect, a step indicator in a multi-step flow, or a value you need to read reactively outside of `form.Field` like a password strength meter).

**Validation:** Define a Zod schema and pass it to `validators: { onChange: MySchema }` at the form level. Use `z.string().email()` for email validation — never use raw regex.

Read `references/creating-forms.md` for the full implementation pattern and common mistakes.

## Route Protection

Route protection uses Clerk middleware in `apps/web/src/proxy.ts` (this file serves as the Next.js middleware):

```typescript
const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);
```

- All routes are protected by default
- Public routes must be explicitly registered in `isPublicRoute`
- Protected routes live under `/portal/` — the portal layout redirects to sign-in if unauthenticated
- Next.js `typedRoutes: true` is enabled — route strings are type-checked at compile time
- Read `references/adding-unprotected-route.md` when adding a new public (unauthenticated) route

## Clerk Hooks

Clerk provides two hooks used throughout the frontend — know when to reach for each:

| Hook | Returns | Use when |
|------|---------|----------|
| `useAuth()` | `isSignedIn`, `isLoaded`, `userId` | Checking auth state (route guards, conditional rendering) |
| `useUser()` | `user` object (name, email, imageUrl) | Displaying user profile data |

- `useAuth()` is lighter — use it when you only need to know *if* the user is signed in
- `useUser()` fetches the full Clerk user object — use it when you need profile fields
- Both require `"use client"` since they are hooks
- Neither replaces oRPC hooks — Clerk hooks provide *auth/identity* data; oRPC hooks provide *application* data from your database

## Page Structure

Pages use the Next.js App Router convention (`app/<route>/page.tsx`).

### `"use client"` Decision

- **Default to server component** (no directive) for static pages, marketing content, or pages that only render props/params
- **Add `"use client"`** when the page uses hooks (`useState`, `useAuth`, `useForm`, TanStack Query hooks, etc.)
- Most portal pages need `"use client"` because they fetch data via oRPC hooks or check auth state

### Portal Page Pattern

Protected pages follow a consistent layout:

```typescript
// app/portal/email/page.tsx
"use client";

import { BaseLayout } from "../../../components/base-layout";
import { useInviteEmail } from "../../../api/email.api";

export default function EmailPage() {
	const invite = useInviteEmail({ onSuccess: () => { /* ... */ } });

	return (
		<BaseLayout title="Email" description="Send invite emails using Resend.">
			{/* Page content using Card components */}
		</BaseLayout>
	);
}
```

- Wrap content in `BaseLayout` for consistent header/card structure — it accepts `title` and `description` props for the page header
- Handle loading states with `Spinner` (from `components/loader.tsx`) for full-page loading, or inline skeleton placeholders for partial content
- Use `Skeleton` components (from `@repo/ui`) for placeholder shapes while data loads

## Error Handling

See `/cl-error-handling` for the full error model. The key frontend rules:

- **Queries**: errors handled globally via `QueryCache` in `utils/tanstack-query.ts` — automatic toast with retry. No per-component error handling needed unless you want custom behavior.
- **Mutations**: errors handled globally via `MutationCache` in `utils/tanstack-query.ts` — automatic toast. Do NOT add `onError` just for error toasts (it would duplicate the global handler). Only use `onError` for custom side effects (reset form state, clear fields).
- Components consume `error` and `isLoading`/`isPending` from hooks — no local `useState` mirrors, no component-level try/catch.

## Providers

App-wide providers live in `providers/` (`apps/web/src/providers/`):

- `providers.tsx` — Root provider composition (`ThemeProvider` + `QueryClientProvider` + `Toaster` + devtools)
- `theme-provider.tsx` — next-themes wrapper for light/dark mode
- `sidebar-control-provider.tsx` — Sidebar open/close state via React Context

Custom hooks for shared state (e.g., `useSidebarControl()`) are co-located with their context provider in `providers/`. Keep context providers here — not scattered across `components/`.

## Styling Utilities

- Use `cn()` from `@repo/ui/lib/utils` for conditional class merging (wraps clsx + tailwind-merge)
- Biome enforces sorted Tailwind classes in `cn()`, `clsx()`, and `cva()` calls automatically

## Import Rules

- Cross-package imports must use `@repo/*` aliases (e.g., `@repo/ui/components/button`) — Biome blocks relative imports between packages/apps
- Within `apps/web/src/`, use relative imports (no `@/*` path alias is configured)
