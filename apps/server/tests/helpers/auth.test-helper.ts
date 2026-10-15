import { vi } from "vitest";

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
			createUser: vi.fn().mockResolvedValue({
				id: "user_new_clerk_456",
				emailAddresses: [{ emailAddress: "new@example.com" }],
				firstName: "New",
				lastName: "User",
				imageUrl: null,
			}),
			updateUser: vi.fn().mockResolvedValue({}),
			deleteUser: vi.fn().mockResolvedValue({}),
		},
	},
}));
