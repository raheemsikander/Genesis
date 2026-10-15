import { ORPCError } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnsureUserExists = vi.fn();

vi.mock("../controllers/user/user.service", () => ({
	ensureUserExists: (...args: unknown[]) => mockEnsureUserExists(...args),
}));

vi.mock("../utils/logger", () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
}));

import { loadActiveDbUser } from "./procedures";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("loadActiveDbUser", () => {
	it("translates ensureUserExists Error to INTERNAL_SERVER_ERROR with friendly message", async () => {
		mockEnsureUserExists.mockRejectedValue(
			new Error("Identity provider unavailable. Please try again."),
		);

		await expect(loadActiveDbUser("user_1")).rejects.toMatchObject({
			code: "INTERNAL_SERVER_ERROR",
			message: "Identity provider unavailable. Please try again.",
		});
	});

	it("falls back to generic message when thrown value is not an Error", async () => {
		mockEnsureUserExists.mockRejectedValue("string failure");

		await expect(loadActiveDbUser("user_2")).rejects.toMatchObject({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to load user account",
		});
	});

	it("throws UNAUTHORIZED when user is soft-deleted", async () => {
		mockEnsureUserExists.mockResolvedValue({
			id: 3,
			uuid: "uuid-3",
			role: "admin",
			deletedAt: new Date("2026-01-01"),
		});

		await expect(loadActiveDbUser("user_3")).rejects.toMatchObject({
			code: "UNAUTHORIZED",
			message: "User account is deleted",
		});
	});

	it("returns the active dbUser", async () => {
		const dbUser = {
			id: 4,
			uuid: "uuid-4",
			role: "member",
			deletedAt: null,
		};
		mockEnsureUserExists.mockResolvedValue(dbUser);

		const result = await loadActiveDbUser("user_4");

		expect(result).toBe(dbUser);
	});

	it("throws ORPCError instances (not plain Errors) on failure paths", async () => {
		mockEnsureUserExists.mockResolvedValue({
			id: 5,
			uuid: "uuid-5",
			role: "member",
			deletedAt: new Date(),
		});

		await expect(loadActiveDbUser("user_5")).rejects.toBeInstanceOf(ORPCError);
	});
});
