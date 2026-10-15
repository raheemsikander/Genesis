import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAuth = vi.fn();
const mockEnsureUserExists = vi.fn();

vi.mock("@clerk/express", () => ({
	getAuth: (...args: unknown[]) => mockGetAuth(...args),
}));

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

import { requireAdmin } from "./require-admin";

type MockRes = Response & {
	status: ReturnType<typeof vi.fn>;
	json: ReturnType<typeof vi.fn>;
};

function makeRes(): MockRes {
	const res = {} as MockRes;
	res.status = vi.fn().mockReturnValue(res);
	res.json = vi.fn().mockReturnValue(res);
	return res;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("requireAdmin", () => {
	it("returns 401 when no Clerk user is on the request", async () => {
		mockGetAuth.mockReturnValue({ userId: null });
		const res = makeRes();
		const next = vi.fn();

		await requireAdmin({} as Request, res, next);

		expect(res.status).toHaveBeenCalledWith(401);
		expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
		expect(next).not.toHaveBeenCalled();
		expect(mockEnsureUserExists).not.toHaveBeenCalled();
	});

	it("calls next() when user is admin and not soft-deleted", async () => {
		mockGetAuth.mockReturnValue({ userId: "user_1" });
		mockEnsureUserExists.mockResolvedValue({
			id: 1,
			uuid: "uuid-1",
			role: "admin",
			deletedAt: null,
		});
		const res = makeRes();
		const next = vi.fn();

		await requireAdmin({} as Request, res, next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(res.status).not.toHaveBeenCalled();
	});

	it("returns 403 when user is a member", async () => {
		mockGetAuth.mockReturnValue({ userId: "user_2" });
		mockEnsureUserExists.mockResolvedValue({
			id: 2,
			uuid: "uuid-2",
			role: "member",
			deletedAt: null,
		});
		const res = makeRes();
		const next = vi.fn();

		await requireAdmin({} as Request, res, next);

		expect(res.status).toHaveBeenCalledWith(403);
		expect(res.json).toHaveBeenCalledWith({ error: "Forbidden" });
		expect(next).not.toHaveBeenCalled();
	});

	it("returns 401 when admin has been soft-deleted", async () => {
		mockGetAuth.mockReturnValue({ userId: "user_3" });
		mockEnsureUserExists.mockResolvedValue({
			id: 3,
			uuid: "uuid-3",
			role: "admin",
			deletedAt: new Date("2026-01-01"),
		});
		const res = makeRes();
		const next = vi.fn();

		await requireAdmin({} as Request, res, next);

		expect(res.status).toHaveBeenCalledWith(401);
		expect(res.json).toHaveBeenCalledWith({ error: "User account is deleted" });
		expect(next).not.toHaveBeenCalled();
	});

	it("returns 500 and surfaces friendly message when ensureUserExists throws", async () => {
		mockGetAuth.mockReturnValue({ userId: "user_4" });
		mockEnsureUserExists.mockRejectedValue(
			new Error("Identity provider unavailable. Please try again."),
		);
		const res = makeRes();
		const next = vi.fn();

		await requireAdmin({} as Request, res, next);

		expect(res.status).toHaveBeenCalledWith(500);
		expect(res.json).toHaveBeenCalledWith({
			error: "Identity provider unavailable. Please try again.",
		});
		expect(next).not.toHaveBeenCalled();
	});

	it("returns 500 with a generic message when a non-Error is thrown", async () => {
		mockGetAuth.mockReturnValue({ userId: "user_5" });
		mockEnsureUserExists.mockRejectedValue("db exploded");
		const res = makeRes();
		const next = vi.fn();

		await requireAdmin({} as Request, res, next);

		expect(res.status).toHaveBeenCalledWith(500);
		expect(res.json).toHaveBeenCalledWith({ error: "Internal Server Error" });
		expect(next).not.toHaveBeenCalled();
	});
});
