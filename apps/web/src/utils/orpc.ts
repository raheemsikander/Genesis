import type { Clerk } from "@clerk/nextjs/types";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouterClient } from "@repo/orpc-contracts";
import { env } from "./env";
import { rollbar } from "./rollbar";

const link = new RPCLink({
	url: `${env.NEXT_PUBLIC_SERVER_URL}/rpc`,
	headers: async () => {
		// Generated client-side so the same ID is available in the browser (DevTools, Rollbar) and server logs
		const requestId = crypto.randomUUID();
		const headers: Record<string, string> = {
			"x-request-id": requestId,
		};

		rollbar.configure({ payload: { custom: { requestId } } });

		if (typeof window === "undefined") {
			return headers;
		}

		const clerk = window.Clerk as Clerk;

		if (!clerk?.loaded || !clerk.session) {
			return headers;
		}

		const token = await clerk.session.getToken();

		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}

		return headers;
	},
});

const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
