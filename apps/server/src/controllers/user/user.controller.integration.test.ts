import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestUser } from "../../../tests/factories";
import {
	createTestApp,
	withAuth,
} from "../../../tests/helpers/app.test-helper";
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
	describe("with existing user", () => {
		beforeEach(async () => {
			await createTestUser();
		});

		it("returns authenticated user with uuid and role", async () => {
			const res = await withAuth(request(app).post("/rpc/user/me")).expect(200);
			const body = rpcBody(res);

			expect(body).toMatchObject({
				email: "test@example.com",
				name: "Test User",
				role: "member",
			});
			expect(body).toHaveProperty("uuid");
			expect(body).not.toHaveProperty("id");
			expect(body).not.toHaveProperty("clerkId");
		});

		it("returns 401 without auth", async () => {
			const res = await request(app).post("/rpc/user/me");
			expect(res.status).toBe(401);
		});
	});

	it("auto-inserts user from Clerk on first authenticated request", async () => {
		const res = await withAuth(request(app).post("/rpc/user/me")).expect(200);
		const body = rpcBody(res);

		expect(body).toMatchObject({
			email: "test@example.com",
			role: "member",
		});
		expect(body).toHaveProperty("uuid");
	});
});

describe("user.getPreferences", () => {
	beforeEach(async () => {
		await createTestUser({ preferences: { theme: "dark" } });
	});

	it("returns user preferences", async () => {
		const res = await withAuth(
			request(app).post("/rpc/user/getPreferences"),
		).expect(200);

		expect(rpcBody(res)).toEqual({ theme: "dark" });
	});

	it("returns 401 without auth", async () => {
		const res = await request(app).post("/rpc/user/getPreferences");
		expect(res.status).toBe(401);
	});
});

describe("user.setPreferences", () => {
	beforeEach(async () => {
		await createTestUser({ preferences: { theme: "light" } });
	});

	it("updates and returns preferences", async () => {
		const res = await withAuth(
			request(app)
				.post("/rpc/user/setPreferences")
				.set("Content-Type", "application/json")
				.send(JSON.stringify({ json: { theme: "dark" } })),
		).expect(200);

		expect(rpcBody(res)).toEqual(expect.objectContaining({ theme: "dark" }));
	});

	it("returns 401 without auth", async () => {
		const res = await request(app).post("/rpc/user/setPreferences");
		expect(res.status).toBe(401);
	});
});
