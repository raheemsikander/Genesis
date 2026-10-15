import { RPCHandler } from "@orpc/server/node";
import express from "express";
import type { Test } from "supertest";
import { appRouter, createAuthContext } from "../../src/orpc";
import { TEST_CLERK_USER_ID } from "./auth.test-helper";

export function createTestApp(): express.Express {
	const app = express();

	app.use(express.json());

	app.get("/health", (_req, res) => {
		res.json({ ok: true });
	});

	const rpcHandler = new RPCHandler(appRouter);

	app.use(async (req, res, next) => {
		const result = await rpcHandler.handle(req, res, {
			prefix: "/rpc",
			context: await createAuthContext({ req }),
		});

		if (!result.matched) {
			next();
		}
	});

	return app;
}

export function withAuth(req: Test, userId: string = TEST_CLERK_USER_ID): Test {
	return req.set("x-test-user-id", userId);
}
