import type { AddressInfo } from "node:net";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type { appRouter } from "../../src/orpc";
import { createTestApp } from "./app.test-helper";
import { TEST_AUTH_HEADER, TEST_CLERK_USER_ID } from "./auth.test-helper";

export type TestClient = RouterClient<typeof appRouter>;

export type TestServer = {
	client: (clerkUserId?: string) => TestClient;
	anonymousClient: () => TestClient;
	close: () => Promise<void>;
};

/**
 * Listens on an ephemeral port and hands back a genuine oRPC client rather
 * than a supertest wrapper: uploadFile takes a `File`, so only the real client
 * exercises the serialization a browser or the mobile app actually performs.
 */
export async function startTestServer(): Promise<TestServer> {
	const server = createTestApp().listen(0);

	await new Promise<void>((resolve, reject) => {
		server.once("listening", resolve);
		server.once("error", reject);
	});

	const { port } = server.address() as AddressInfo;
	const url = `http://127.0.0.1:${port}/rpc`;

	const createClient = (clerkUserId?: string): TestClient =>
		createORPCClient(
			new RPCLink({
				url,
				headers: () => (clerkUserId ? { [TEST_AUTH_HEADER]: clerkUserId } : {}),
			}),
		);

	return {
		client: (clerkUserId = TEST_CLERK_USER_ID) => createClient(clerkUserId),
		anonymousClient: () => createClient(),
		close: () =>
			new Promise<void>((resolve, reject) => {
				server.close((err) => (err ? reject(err) : resolve()));
			}),
	};
}
