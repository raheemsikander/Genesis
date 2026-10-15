import { getClerkInstance } from "@clerk/expo";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouterClient } from "@repo/orpc-contracts";
import { env } from "./env";

// Token comes from the Clerk Expo singleton (not a hook) since headers() runs outside React.
const link = new RPCLink({
	url: `${env.EXPO_PUBLIC_SERVER_URL}/rpc`,
	headers: async () => {
		const headers: Record<string, string> = {};

		// Best-effort request ID for tracing. Hermes does not guarantee crypto.randomUUID;
		// the server generates its own ID when this header is absent.
		const requestId = globalThis.crypto?.randomUUID?.();
		if (requestId) {
			headers["x-request-id"] = requestId;
		}

		const token = await getClerkInstance().session?.getToken();
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}

		return headers;
	},
});

const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
