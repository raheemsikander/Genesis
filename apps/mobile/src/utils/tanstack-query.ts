import { queryRetryOptions } from "@repo/orpc-contracts";
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			...queryRetryOptions,
		},
		mutations: {
			retry: false,
		},
	},
});
