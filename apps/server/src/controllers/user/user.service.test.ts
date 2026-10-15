import { ORPCError } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn(() => ({ where: mockWhere }));
const mockWhere = vi.fn(() => ({ returning: mockReturning }));
const mockReturning = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn(() => ({ onConflictDoNothing: mockOnConflict }));
const mockOnConflict = vi.fn(() => ({ returning: mockInsertReturning }));
const mockInsertReturning = vi.fn();
const mockGetUser = vi.fn();

vi.mock("../../db/db", () => ({
	db: {
		query: {
			users: {
				findFirst: (...args: unknown[]) => mockFindFirst(...args),
				findMany: (...args: unknown[]) => mockFindMany(...args),
			},
		},
		update: (...args: unknown[]) => {
			mockUpdate(...args);
			return { set: mockSet };
		},
		insert: (...args: unknown[]) => {
			mockInsert(...args);
			return { values: mockValues };
		},
	},
}));

vi.mock("../../db", () => ({
	users: { id: "id", clerkId: "clerk_id", createdAt: "created_at" },
}));

vi.mock("../../utils/logger", () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
}));

vi.mock("@clerk/express", () => ({
	clerkClient: {
		users: {
			getUser: (...args: unknown[]) => mockGetUser(...args),
		},
	},
}));

import {
	ensureUserExists,
	getUserById,
	getUserPreferences,
	listUsers,
	updateUserPreferences,
} from "./user.service";

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("getUserById", () => {
	it("returns API-safe user shape when found", async () => {
		const mockUser = {
			id: 1,
			uuid: "550e8400-e29b-41d4-a716-446655440000",
			clerkId: "user_clerk_1",
			email: "test@example.com",
			name: "Test",
			role: "member",
			imageUrl: null,
			preferences: {},
			createdBy: null,
			createdAt: new Date(),
			updatedBy: null,
			updatedAt: new Date(),
		};
		mockFindFirst.mockResolvedValue({
			...mockUser,
			createdByUser: null,
			updatedByUser: null,
		});

		const result = await getUserById(1);

		expect(result).toEqual({
			uuid: "550e8400-e29b-41d4-a716-446655440000",
			email: "test@example.com",
			name: "Test",
			role: "member",
			imageUrl: null,
			preferences: {},
			createdBy: null,
			createdAt: mockUser.createdAt,
			updatedBy: null,
			updatedAt: mockUser.updatedAt,
		});
		expect(result).not.toHaveProperty("id");
		expect(result).not.toHaveProperty("clerkId");
	});

	it("maps createdByUser/updatedByUser uuids to createdBy/updatedBy", async () => {
		const createdByUuid = "11111111-1111-1111-1111-111111111111";
		const updatedByUuid = "22222222-2222-2222-2222-222222222222";
		const mockUser = {
			id: 1,
			uuid: "550e8400-e29b-41d4-a716-446655440000",
			clerkId: "user_clerk_1",
			email: "test@example.com",
			name: "Test",
			role: "member",
			imageUrl: null,
			preferences: {},
			createdBy: 2,
			createdAt: new Date(),
			updatedBy: 3,
			updatedAt: new Date(),
		};
		mockFindFirst.mockResolvedValue({
			...mockUser,
			createdByUser: { uuid: createdByUuid },
			updatedByUser: { uuid: updatedByUuid },
		});

		const result = await getUserById(1);

		expect(result.createdBy).toBe(createdByUuid);
		expect(result.updatedBy).toBe(updatedByUuid);
	});

	it("throws NOT_FOUND when user does not exist", async () => {
		mockFindFirst.mockResolvedValue(undefined);

		await expect(getUserById(999)).rejects.toThrow(ORPCError);
		await expect(getUserById(999)).rejects.toThrow("User not found");
	});
});

describe("getUserPreferences", () => {
	it("returns preferences for existing user", async () => {
		mockFindFirst.mockResolvedValue({ preferences: { theme: "dark" } });

		const result = await getUserPreferences(1);

		expect(result).toEqual({ theme: "dark" });
	});

	it("throws NOT_FOUND when user does not exist", async () => {
		mockFindFirst.mockResolvedValue(undefined);

		await expect(getUserPreferences(999)).rejects.toThrow("User not found");
	});
});

describe("updateUserPreferences", () => {
	it("merges input with existing preferences and returns result", async () => {
		mockFindFirst.mockResolvedValue({ preferences: { theme: "light" } });
		mockReturning.mockResolvedValue([{ preferences: { theme: "dark" } }]);

		const result = await updateUserPreferences(1, {
			theme: "dark",
		});

		expect(result).toEqual({ theme: "dark" });
		expect(mockSet).toHaveBeenCalledWith(
			expect.objectContaining({
				preferences: { theme: "dark" },
			}),
		);
	});

	it("preserves existing keys when merging", async () => {
		mockFindFirst.mockResolvedValue({
			preferences: { theme: "light", lang: "en" },
		});
		mockReturning.mockResolvedValue([
			{ preferences: { theme: "dark", lang: "en" } },
		]);

		const result = await updateUserPreferences(1, {
			theme: "dark",
		});

		expect(result).toEqual({ theme: "dark", lang: "en" });
		expect(mockSet).toHaveBeenCalledWith(
			expect.objectContaining({
				preferences: { theme: "dark", lang: "en" },
			}),
		);
	});

	it("throws NOT_FOUND when user does not exist", async () => {
		mockFindFirst.mockResolvedValue(undefined);

		await expect(updateUserPreferences(999, { theme: "dark" })).rejects.toThrow(
			"User not found",
		);
	});

	it("throws NOT_FOUND when update returns empty", async () => {
		mockFindFirst.mockResolvedValue({ preferences: {} });
		mockReturning.mockResolvedValue([]);

		await expect(updateUserPreferences(1, { theme: "dark" })).rejects.toThrow(
			"User not found",
		);
	});
});

describe("ensureUserExists", () => {
	it("returns existing row without calling Clerk", async () => {
		const existing = {
			id: 1,
			uuid: "uuid-1",
			role: "admin",
			deletedAt: null,
		};
		mockFindFirst.mockResolvedValueOnce(existing);

		const result = await ensureUserExists("user_clerk_1");

		expect(result).toEqual(existing);
		expect(mockGetUser).not.toHaveBeenCalled();
		expect(mockInsert).not.toHaveBeenCalled();
	});

	it("returns soft-deleted row so caller can enforce", async () => {
		const deleted = {
			id: 2,
			uuid: "uuid-2",
			role: "member",
			deletedAt: new Date("2026-01-01"),
		};
		mockFindFirst.mockResolvedValueOnce(deleted);

		const result = await ensureUserExists("user_clerk_2");

		expect(result).toEqual(deleted);
		expect(mockGetUser).not.toHaveBeenCalled();
	});

	it("creates new user with role from Clerk unsafeMetadata", async () => {
		mockFindFirst.mockResolvedValueOnce(undefined);
		mockGetUser.mockResolvedValueOnce({
			emailAddresses: [{ emailAddress: "new@example.com" }],
			firstName: "New",
			lastName: "User",
			imageUrl: "https://img",
			unsafeMetadata: { role: "admin" },
		});
		const inserted = {
			id: 3,
			uuid: "uuid-3",
			role: "admin",
			deletedAt: null,
		};
		mockInsertReturning.mockResolvedValueOnce([inserted]);

		const result = await ensureUserExists("user_clerk_3");

		expect(result).toEqual(inserted);
		expect(mockValues).toHaveBeenCalledWith(
			expect.objectContaining({
				clerkId: "user_clerk_3",
				email: "new@example.com",
				name: "New User",
				imageUrl: "https://img",
				role: "admin",
			}),
		);
	});

	it("defaults to member when Clerk metadata role is invalid", async () => {
		mockFindFirst.mockResolvedValueOnce(undefined);
		mockGetUser.mockResolvedValueOnce({
			emailAddresses: [{ emailAddress: "x@example.com" }],
			firstName: null,
			lastName: null,
			imageUrl: null,
			unsafeMetadata: { role: "superadmin" },
		});
		const inserted = {
			id: 4,
			uuid: "uuid-4",
			role: "member",
			deletedAt: null,
		};
		mockInsertReturning.mockResolvedValueOnce([inserted]);

		await ensureUserExists("user_clerk_4");

		expect(mockValues).toHaveBeenCalledWith(
			expect.objectContaining({ role: "member" }),
		);
	});

	it("re-reads row when concurrent insert wins the race", async () => {
		const existing = {
			id: 5,
			uuid: "uuid-5",
			role: "member",
			deletedAt: null,
		};
		mockFindFirst
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce(existing);
		mockGetUser.mockResolvedValueOnce({
			emailAddresses: [{ emailAddress: "race@example.com" }],
			firstName: "R",
			lastName: "A",
			imageUrl: null,
			unsafeMetadata: { role: "member" },
		});
		mockInsertReturning.mockResolvedValueOnce([]);

		const result = await ensureUserExists("user_clerk_5");

		expect(result).toEqual(existing);
	});

	it("throws friendly Error when Clerk lookup fails", async () => {
		mockFindFirst.mockResolvedValueOnce(undefined);
		mockGetUser.mockRejectedValueOnce(new Error("clerk down"));

		await expect(ensureUserExists("user_clerk_6")).rejects.toThrow(
			"Identity provider unavailable. Please try again.",
		);
	});

	it("throws when insert is a no-op and re-fetch finds nothing", async () => {
		mockFindFirst
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce(undefined);
		mockGetUser.mockResolvedValueOnce({
			emailAddresses: [{ emailAddress: "x@example.com" }],
			firstName: null,
			lastName: null,
			imageUrl: null,
			unsafeMetadata: undefined,
		});
		mockInsertReturning.mockResolvedValueOnce([]);

		await expect(ensureUserExists("user_clerk_7")).rejects.toThrow(
			"Failed to create user account",
		);
	});

	it("retries the Clerk lookup on a transient error before provisioning", async () => {
		// Pin jitter to 0 so withRetry's backoff sleep is ~0ms (no real wait).
		vi.spyOn(Math, "random").mockReturnValue(0);
		mockFindFirst.mockResolvedValueOnce(undefined);
		mockGetUser.mockRejectedValueOnce({ status: 503 }).mockResolvedValueOnce({
			emailAddresses: [{ emailAddress: "retry@example.com" }],
			firstName: "Re",
			lastName: "Try",
			imageUrl: null,
			unsafeMetadata: { role: "member" },
		});
		const inserted = { id: 9, uuid: "uuid-9", role: "member", deletedAt: null };
		mockInsertReturning.mockResolvedValueOnce([inserted]);

		const result = await ensureUserExists("user_clerk_retry");

		expect(result).toEqual(inserted);
		expect(mockGetUser).toHaveBeenCalledTimes(2);
	});
});

describe("listUsers", () => {
	it("returns all users in a { users } envelope", async () => {
		const rows = [
			{
				uuid: "uuid-a",
				email: "a@example.com",
				name: "A",
				role: "admin",
				imageUrl: null,
				createdAt: new Date(),
			},
		];
		mockFindMany.mockResolvedValueOnce(rows);

		const result = await listUsers();

		expect(result).toEqual({ users: rows });
		expect(mockFindMany).toHaveBeenCalledTimes(1);
	});
});
