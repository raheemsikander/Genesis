import { ORPCError } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn(() => ({ where: mockWhere }));
const mockWhere = vi.fn(() => ({ returning: mockReturning }));
const mockReturning = vi.fn();

vi.mock("../../db/db", () => ({
	db: {
		query: {
			users: {
				findFirst: (...args: unknown[]) => mockFindFirst(...args),
			},
		},
		update: (...args: unknown[]) => {
			mockUpdate(...args);
			return { set: mockSet };
		},
	},
}));

vi.mock("../../db", () => ({
	users: { clerkId: "clerk_id" },
}));

import {
	getUserByClerkId,
	getUserPreferences,
	updateUserPreferences,
} from "./user.service";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("getUserByClerkId", () => {
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
		mockFindFirst.mockResolvedValue(mockUser);

		const result = await getUserByClerkId("user_clerk_1");

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

	it("throws NOT_FOUND when user does not exist", async () => {
		mockFindFirst.mockResolvedValue(undefined);

		await expect(getUserByClerkId("nonexistent")).rejects.toThrow(ORPCError);
		await expect(getUserByClerkId("nonexistent")).rejects.toThrow(
			"User not found",
		);
	});
});

describe("getUserPreferences", () => {
	it("returns preferences for existing user", async () => {
		mockFindFirst.mockResolvedValue({ preferences: { theme: "dark" } });

		const result = await getUserPreferences("user_clerk_1");

		expect(result).toEqual({ theme: "dark" });
	});

	it("throws NOT_FOUND when user does not exist", async () => {
		mockFindFirst.mockResolvedValue(undefined);

		await expect(getUserPreferences("nonexistent")).rejects.toThrow(
			"User not found",
		);
	});
});

describe("updateUserPreferences", () => {
	it("merges input with existing preferences and returns result", async () => {
		mockFindFirst.mockResolvedValue({ preferences: { theme: "light" } });
		mockReturning.mockResolvedValue([{ preferences: { theme: "dark" } }]);

		const result = await updateUserPreferences("user_clerk_1", {
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

		const result = await updateUserPreferences("user_clerk_1", {
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

		await expect(
			updateUserPreferences("nonexistent", { theme: "dark" }),
		).rejects.toThrow("User not found");
	});

	it("throws NOT_FOUND when update returns empty", async () => {
		mockFindFirst.mockResolvedValue({ preferences: {} });
		mockReturning.mockResolvedValue([]);

		await expect(
			updateUserPreferences("user_clerk_1", { theme: "dark" }),
		).rejects.toThrow("User not found");
	});
});
