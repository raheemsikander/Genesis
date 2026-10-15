# Testing Patterns

Canonical testing guide for this project.

## Table of Contents

- [Philosophy](#philosophy)
- [Test Commands](#test-commands)
- [Backend Testing](#backend-testing)
  - [Integration Test Setup (Real DB)](#integration-test-setup-real-db)
  - [Database Isolation Strategy](#database-isolation-strategy)
  - [Fixture and Factory Patterns](#fixture-and-factory-patterns)
  - [Clerk Auth Mocking (Backend)](#clerk-auth-mocking-backend)
  - [oRPC Endpoint Testing](#orpc-endpoint-testing)
  - [Unit Testing Services](#unit-testing-services)
- [Frontend Testing](#frontend-testing)
  - [Component Testing with Testing Library](#component-testing-with-testing-library)
  - [oRPC Mock Handler Patterns](#orpc-mock-handler-patterns)
  - [Clerk Auth Mocking (Frontend)](#clerk-auth-mocking-frontend)
  - [Rendering with Providers](#rendering-with-providers)
- [E2E Testing (Playwright)](#e2e-testing-playwright)
- [Test Naming Conventions](#test-naming-conventions)
- [What to Test (and What Not To)](#what-to-test-and-what-not-to)
- [Coverage Expectations](#coverage-expectations)

---

## Philosophy

- **Write meaningful tests.** The purpose of testing is to catch real bugs and prevent regressions — not to hit coverage numbers. Every test should justify its existence by protecting against a failure that would matter in production.
- **Prefer integration tests.** Integration tests cover more surface area and catch real issues. They are the default choice for backend testing.
- **Reserve unit tests for complex business logic.** Only write unit tests when a service function has branching logic, complex transformations, or edge cases that are hard to exercise through an integration test. Don't unit-test simple CRUD pass-throughs.
- **Integration tests hit a real database.** No mocking Drizzle queries in integration tests — use a real PostgreSQL instance.
- **Frontend tests use contract-driven mocks.** oRPC handlers are built from actual contracts, so mock responses match the real API schema.
- **Tests are colocated with source.** Test files live next to the code they test, not in a separate top-level directory.

## Test Commands

```bash
# Backend
pnpm test:server:unit          # Unit tests only
pnpm test:server:integration   # Integration tests (requires TEST_DATABASE_URL)

# Frontend
pnpm test:web                  # Component + utility tests

# E2E
pnpm test:e2e                  # Playwright (starts app processes automatically; requires correct env vars)
pnpm test:e2e:ui               # Playwright in interactive UI mode
pnpm test:e2e:report           # View last Playwright HTML report
```

---

## Backend Testing

All backend tests use Vitest. Configuration lives in two files:

- `apps/server/vitest.unit.config.ts` — unit tests (excludes `*.integration.test.ts`)
- `apps/server/vitest.integration.config.ts` — integration tests (only `*.integration.test.ts`)

### Integration Test Setup (Real DB)

Integration tests run against a real Postgres database, Redis instance, and MinIO bucket, all ephemeral. The test command auto-starts and initializes this stack, but you can also start it manually:

```bash
pnpm infra:test:up
```

This starts Postgres, Redis, and MinIO on the sandbox slot's test ports (**5434**, **6380**, and **9002**/**9003** at slot 0, separate from the dev stack). `pnpm test:server:integration` exports the matching connection strings (`TEST_DATABASE_URL`, `REDIS_URL`, `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`) for the resolved slot:

```
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5434/genesis_test
```

The setup is:

1. **Global setup** (`apps/server/vitest.global-setup.ts`) validates that `TEST_DATABASE_URL` contains `"test"` (safety check), then syncs the schema with `drizzle-kit push --force`. This substring check is intentionally simple: CI always uses `genesis_test` as the database name. For extra safety in local development, use a database name like `genesis_test` that makes the intent obvious. It also refuses to run if `REDIS_URL` or `S3_ENDPOINT` is set without the wrapper's marker, so a run started outside `pnpm test:server:integration` can't silently connect to the dev Redis or dev bucket.
2. **Per-file setup** (`apps/server/tests/helpers/setup.test-helper.ts`) re-validates the URL and registers `afterAll` to close the DB connection.

```ts
// apps/server/vitest.global-setup.ts
export default function globalSetup() {
	const testDbUrl = env.TEST_DATABASE_URL;
	if (!testDbUrl) {
		throw new Error("TEST_DATABASE_URL is required to run tests");
	}
	if (!testDbUrl.includes("test")) {
		throw new Error(
			`Safety check: TEST_DATABASE_URL must contain "test". Got: ${testDbUrl}`,
		);
	}

	execSync("pnpm drizzle-kit push --force", {
		cwd: import.meta.dirname,
		stdio: "inherit",
	});
}
```

CI configures a PostgreSQL 17 service and sets `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/genesis_test`.

### Database Isolation Strategy

Tests use **truncation** — not transactions — for isolation. Each test suite truncates the tables it uses in `afterEach`:

```ts
// apps/server/tests/helpers/db.test-helper.ts
import type { Table } from "drizzle-orm";
import { getTableName, sql } from "drizzle-orm";
import { db } from "../../src/db/db";

export async function truncateTables(...tables: Table[]) {
	for (const table of tables) {
		await db.execute(
			sql.raw(`TRUNCATE TABLE "${getTableName(table)}" CASCADE`),
		);
	}
}
```

Usage in a test file:

```ts
import { truncateTables } from "../../../tests/helpers/db.test-helper";
import { users } from "../../db/schema";

afterEach(async () => {
	await truncateTables(users);
});
```

Why truncation over transactions: truncation with `CASCADE` is simpler, doesn't interfere with transaction-dependent application code, and resets sequences.

### Fixture and Factory Patterns

Factories are plain async functions (not classes) in `apps/server/tests/factories/`. They insert real rows into the test database and return the created record.

```ts
// apps/server/tests/factories/user.factory.ts
import { db } from "../../src/db/db";
import { users } from "../../src/db/schema";
import { TEST_CLERK_USER_ID } from "../helpers/auth.test-helper";

type UserInsert = typeof users.$inferInsert;

export async function createTestUser(overrides?: Partial<UserInsert>) {
	const defaults: UserInsert = {
		id: TEST_CLERK_USER_ID,
		email: "test@example.com",
		name: "Test User",
		isAppAdmin: false,
		imageUrl: "https://example.com/avatar.png",
		preferences: { theme: "dark" as const },
	};

	const [user] = await db
		.insert(users)
		.values({ ...defaults, ...overrides })
		.returning();

	return user!;
}
```

Conventions:
- One factory per entity in `apps/server/tests/factories/`
- Export via barrel file `apps/server/tests/factories/index.ts`
- Provide sensible defaults, accept partial overrides
- Use `$inferInsert` for type safety
- Return the DB result directly

### Clerk Auth Mocking (Backend)

Integration tests mock the entire `@clerk/express` module. The mock is loaded via `apps/server/tests/helpers/auth.test-helper.ts` (imported by the setup file).

```ts
// apps/server/tests/helpers/auth.test-helper.ts
export const TEST_CLERK_USER_ID = "user_test_clerk_123";

vi.mock("@clerk/express", () => ({
	clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
	getAuth: (req: any) => ({
		userId: req.headers["x-test-user-id"] || null,
	}),
	clerkClient: {
		users: {
			getUser: vi.fn().mockResolvedValue({
				id: TEST_CLERK_USER_ID,
				emailAddresses: [{ emailAddress: "test@example.com" }],
				firstName: "Test",
				lastName: "User",
				imageUrl: "https://example.com/avatar.png",
			}),
		},
	},
}));
```

How it works:
- `clerkMiddleware` becomes a no-op passthrough
- `getAuth` reads the user ID from the `x-test-user-id` header
- `clerkClient.users.getUser` returns a fixed test user
- The `withAuth()` helper sets the header on test requests

### oRPC Endpoint Testing

Integration tests use `supertest` with a real Express app that mounts the oRPC router:

```ts
// apps/server/tests/helpers/app.test-helper.ts
import { RPCHandler } from "@orpc/server/node";
import express from "express";
import type { Test } from "supertest";
import { appRouter, createAuthContext } from "../../src/orpc";
import { TEST_CLERK_USER_ID } from "./auth.test-helper";

export function createTestApp(): express.Express {
	const app = express();
	app.use(express.json());

	const rpcHandler = new RPCHandler(appRouter);
	app.use(async (req, res, next) => {
		const result = await rpcHandler.handle(req, res, {
			prefix: "/rpc",
			context: await createAuthContext({ req }),
		});
		if (!result.matched) next();
	});

	return app;
}

export function withAuth(req: Test, userId: string = TEST_CLERK_USER_ID): Test {
	return req.set("x-test-user-id", userId);
}
```

Full integration test example:

```ts
// src/controllers/user/user.controller.integration.test.ts
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "../../../tests/factories";
import { createTestApp, withAuth } from "../../../tests/helpers/app.test-helper";
import { TEST_CLERK_USER_ID } from "../../../tests/helpers/auth.test-helper";
import { truncateTables } from "../../../tests/helpers/db.test-helper";
import { users } from "../../db/schema";

const app = createTestApp();

function rpcBody(res: request.Response) {
	return res.body?.json ?? res.body;
}

afterEach(async () => {
	await truncateTables(users);
});

describe("user.me", () => {
	beforeEach(async () => {
		await createTestUser();
	});

	it("returns authenticated user", async () => {
		const res = await withAuth(request(app).post("/rpc/user/me")).expect(200);

		expect(rpcBody(res)).toMatchObject({
			id: TEST_CLERK_USER_ID,
			email: "test@example.com",
			name: "Test User",
		});
	});

	it("returns 401 without auth", async () => {
		const res = await request(app).post("/rpc/user/me");
		expect(res.status).toBe(401);
	});
});
```

Key patterns:
- `createTestApp()` once per file, not per test
- `withAuth()` to add authentication to requests
- `rpcBody()` to extract the JSON response (oRPC wraps responses)
- oRPC endpoints are POST requests to `/rpc/<domain>/<method>`

### Unit Testing Services

Service functions are unit-tested with mocked DB calls. Mocks are defined before imports (Vitest hoists `vi.mock` calls). Mock the specific DB methods your service uses — if the service imports schema objects (e.g., `users`, `eq`), you may also need to mock those modules or use the real imports alongside the mocked `db`.

```ts
// src/controllers/user/user.service.test.ts
import { ORPCError } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirst = vi.fn();

vi.mock("../../db/db", () => ({
	db: {
		query: {
			users: {
				findFirst: (...args: unknown[]) => mockFindFirst(...args),
			},
		},
	},
}));

import { getUserById } from "./user.service";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("getUserById", () => {
	it("returns user when found", async () => {
		const mockUser = { id: "user_1", email: "test@example.com" };
		mockFindFirst.mockResolvedValue(mockUser);

		const result = await getUserById("user_1");

		expect(result).toEqual(mockUser);
		expect(mockFindFirst).toHaveBeenCalledOnce();
	});

	it("throws NOT_FOUND when user does not exist", async () => {
		mockFindFirst.mockResolvedValue(undefined);

		await expect(getUserById("nonexistent")).rejects.toThrow(ORPCError);
		await expect(getUserById("nonexistent")).rejects.toThrow("User not found");
	});
});
```

---

## Frontend Testing

Frontend tests use Vitest with `jsdom` environment and React Testing Library. Configuration is in `apps/web/vitest.config.ts`.

### Component Testing with Testing Library

Tests are colocated with components as `*.test.tsx` files. Use React Testing Library queries — prefer accessible queries (`getByRole`, `getByText`, `getByAltText`) over CSS selectors.

```tsx
// src/app/portal/profile/page.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	mockLoadingUser,
	mockUnauthenticatedUser,
	mockUser,
} from "../../../../tests/helpers/clerk.test-helper";
import ProfilePage from "./page";

describe("ProfilePage", () => {
	it("shows loading spinner while user is loading", () => {
		mockLoadingUser();
		const { container } = render(<ProfilePage />);
		expect(container.querySelector(".spinner")).toBeInTheDocument();
	});

	it("shows sign-in prompt when no user", () => {
		mockUnauthenticatedUser();
		render(<ProfilePage />);
		expect(
			screen.getByText("Sign in to view your profile."),
		).toBeInTheDocument();
	});

	it("displays user avatar with name as alt text", () => {
		render(<ProfilePage />);
		const avatar = screen.getByAltText("Test User");
		expect(avatar).toHaveAttribute("src", "https://example.com/avatar.png");
	});
});
```

Guidelines:
- Test user-visible behavior, not implementation details
- Use `getByRole` / `getByText` / `getByAltText` over `querySelector` when possible
- Test loading, error, and empty states
- Don't test framework behavior (e.g. that Next.js routing works)

### oRPC Mock Handler Patterns

Instead of MSW (HTTP-level mocking), the frontend uses **contract-driven oRPC mocks**. Handlers are built from the actual oRPC contracts, so mock responses are validated against real schemas.

```ts
// apps/web/tests/orpc/user.test-handler.ts
import { appContract } from "@repo/orpc-contracts";
import type { UserPreferences, UserSchema } from "@repo/shared";
import { implement } from "@orpc/server";

export const TEST_USER: UserSchema = {
	id: "user_test_123",
	email: "test@example.com",
	name: "Test User",
	isAppAdmin: false,
	imageUrl: "https://example.com/avatar.png",
	preferences: { theme: "dark" as const },
	createdAt: new Date("2025-01-01T00:00:00.000Z"),
	updatedAt: new Date("2025-01-01T00:00:00.000Z"),
};

let userPreferences: UserPreferences = { ...TEST_USER.preferences };

export const userHandlers = {
	me: implement(appContract.user.me).handler(() => TEST_USER),
	getPreferences: implement(appContract.user.getPreferences).handler(
		() => userPreferences,
	),
	setPreferences: implement(appContract.user.setPreferences).handler(
		({ input }) => {
			userPreferences = { ...userPreferences, ...input };
			return userPreferences;
		},
	),
};

export function resetUserMocks() {
	userPreferences = { ...TEST_USER.preferences };
}
```

Handlers are assembled into a test client:

```ts
// apps/web/tests/orpc/client.test-handler.ts
import { createRouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

import { emailHandlers } from "./email.test-handler";
import { resetUserMocks, userHandlers } from "./user.test-handler";

const testRouter = {
	user: userHandlers,
	email: emailHandlers,
};

const client = createRouterClient(testRouter);
export const orpc = createTanstackQueryUtils(client);

export function resetOrpcMocks() {
	resetUserMocks();
}
```

The global setup file mocks the `orpc` import so all components use the test client automatically.

When adding a new domain:
1. Create `apps/web/tests/orpc/<domain>.test-handler.ts` with handlers using `implement(appContract.<domain>.<method>)`
2. Add the handlers to the test router in `apps/web/tests/orpc/client.test-handler.ts`
3. Add a reset function if handlers have mutable state

### Clerk Auth Mocking (Frontend)

Frontend auth is mocked in `apps/web/tests/helpers/clerk.test-helper.ts`. It provides state helpers to simulate authenticated, unauthenticated, and loading states.

```ts
// apps/web/tests/helpers/clerk.test-helper.ts
import { useUser } from "@clerk/nextjs";
import { afterEach, vi } from "vitest";

type ClerkUser = NonNullable<ReturnType<typeof useUser>["user"]>;

export const mockUser = {
	id: "user_test_123",
	fullName: "Test User",
	firstName: "Test",
	lastName: "User",
	primaryEmailAddress: { emailAddress: "test@example.com" },
	imageUrl: "https://example.com/avatar.png",
	createdAt: new Date("2025-01-15T00:00:00.000Z"),
} as unknown as ClerkUser;

const clerkState = { isSignedIn: true, isLoaded: true };

vi.mock("@clerk/nextjs", () => ({
	useUser: () => ({
		user: clerkState.isSignedIn && clerkState.isLoaded ? mockUser : null,
		isLoaded: clerkState.isLoaded,
		isSignedIn: clerkState.isSignedIn && clerkState.isLoaded,
	}),
	useAuth: () => ({
		userId: clerkState.isSignedIn ? "user_test_123" : null,
		isLoaded: true,
		isSignedIn: clerkState.isSignedIn,
		getToken: vi.fn().mockResolvedValue(clerkState.isSignedIn ? "test-token" : null),
	}),
	ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
	SignedIn: ({ children }: { children: React.ReactNode }) =>
		clerkState.isSignedIn ? children : null,
	SignedOut: ({ children }: { children: React.ReactNode }) =>
		clerkState.isSignedIn ? null : children,
}));

// State resets after each test
afterEach(() => {
	clerkState.isSignedIn = true;
	clerkState.isLoaded = true;
});

export function mockAuthenticatedUser() {
	clerkState.isSignedIn = true;
	clerkState.isLoaded = true;
}

export function mockUnauthenticatedUser() {
	clerkState.isSignedIn = false;
	clerkState.isLoaded = true;
}

export function mockLoadingUser() {
	clerkState.isLoaded = false;
}
```

Default state is authenticated — call `mockUnauthenticatedUser()` or `mockLoadingUser()` at the start of tests that need different auth states.

### Rendering with Providers

Use `renderWithProviders()` from `tests/helpers/render.test-helper.tsx` when components need TanStack Query or theme context:

```tsx
import { renderWithProviders } from "../../../../tests/helpers/render.test-helper";

it("renders dashboard", () => {
	renderWithProviders(<Dashboard />);
	expect(screen.getByText("Welcome")).toBeInTheDocument();
});
```

The helper wraps components with `QueryClientProvider` (retries disabled, instant GC) and `ThemeProvider`. For simple components that don't need providers, plain `render()` from Testing Library is fine.

---

## E2E Testing (Playwright)

E2E tests live in `apps/web/e2e/` and use Playwright with real browser interactions.

**Configuration** (`apps/web/playwright.config.ts`):
- Browser: Chromium (Desktop Chrome)
- Base URL: `http://localhost:3001`
- Manages startup of both backend (port 3000) and frontend (port 3001)
- Retries: 2 in CI, 0 locally
- Screenshots on failure, traces on first retry

**Auth setup**: Uses `@clerk/testing/playwright` with a real Clerk test user. Global setup disables MFA/device verification for the test user. The `signInViaUI()` helper fills the sign-in form using credentials from environment variables.

**Environment variables** (in `apps/web/.env`):
```
E2E_CLERK_USER_USERNAME=<test user email>
E2E_CLERK_USER_PASSWORD=<test user password>
CLERK_SECRET_KEY=sk_test_xxxxx
```

Example test:

```ts
import { expect, test } from "@playwright/test";
import { signInViaUI } from "./utils/auth.e2e";

test.describe("Portal (authenticated)", () => {
	test.beforeEach(async ({ page }) => {
		await signInViaUI(page);
	});

	test("dashboard renders welcome message", async ({ page }) => {
		await page.goto("/portal");
		await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
	});
});
```

---

## Test Naming Conventions

### File naming

| Type | Pattern | Example |
|------|---------|---------|
| Unit test | `*.test.ts` / `*.test.tsx` | `user.service.test.ts` |
| Integration test | `*.integration.test.ts` | `user.controller.integration.test.ts` |
| E2E test | `*.test.ts` (in `e2e/`) | `portal.test.ts` |
| Factory | `*.factory.ts` | `user.factory.ts` |
| Test helper | `*.test-helper.ts` / `*.test-helper.tsx` | `auth.test-helper.ts` |

### Test descriptions

- `describe` blocks name the unit under test: `describe("getUserById", ...)`
- `it` blocks describe expected behavior: `it("returns 401 without auth", ...)`
- Nest `describe` blocks for grouping: `describe("with existing user", ...)`

---

## What to Test (and What Not To)

### Test

- **oRPC endpoints (integration first)**: Auth enforcement, input validation, correct responses, database side effects. This is the highest-value test layer on the backend — start here.
- **Complex service logic (unit)**: Only when a service has branching logic, multi-step transformations, or edge cases that are hard to reach through the endpoint. Simple CRUD services don't need their own unit tests if the integration test covers them.
- **Component rendering**: Correct content for each state (loading, error, empty, populated)
- **User interactions**: Form submission, navigation, state changes
- **Edge cases**: Missing data, unauthorized access, concurrent operations

### Don't test

- **Simple pass-through services**: If a service just calls `db.query.users.findFirst()` and throws on null, the integration test already covers it — don't add a unit test
- **Framework internals**: Don't test that Next.js routing works or that Clerk validates JWTs
- **Type-level guarantees**: If TypeScript prevents it, don't write a runtime test for it
- **Drizzle queries directly**: Test through service functions or integration tests
- **Third-party library behavior**: Don't test that `date-fns` formats dates correctly
- **CSS / visual layout**: Use E2E visual regression if needed, not unit tests

---

## Coverage Expectations

Coverage is a guide, not a gate. The goal is meaningful tests, not hitting a number.

| Layer | What to cover |
|-------|--------------|
| Services | All public functions, including error paths |
| Controllers (integration) | Happy path + auth enforcement + validation errors |
| Components | All user-visible states (loading, error, empty, populated) |
| Utilities | Pure functions with edge cases |
| E2E | Critical user flows (sign in, main feature paths) |

Run coverage locally:
```bash
pnpm test:server:unit -- --coverage
pnpm test:web -- --coverage
```
