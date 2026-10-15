import type { useUser } from "@clerk/nextjs";
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
		getToken: vi
			.fn()
			.mockResolvedValue(clerkState.isSignedIn ? "test-token" : null),
	}),
	useClerk: () => ({
		loaded: true,
		session: clerkState.isSignedIn
			? { getToken: vi.fn().mockResolvedValue("test-token") }
			: null,
	}),
	ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
	SignedIn: ({ children }: { children: React.ReactNode }) =>
		clerkState.isSignedIn ? children : null,
	SignedOut: ({ children }: { children: React.ReactNode }) =>
		clerkState.isSignedIn ? null : children,
}));

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
