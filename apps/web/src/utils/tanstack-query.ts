import {
	isRetryableError,
	queryRetryOptions,
	RETRYABLE_CODES,
} from "@repo/orpc-contracts";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export { isRetryableError, queryRetryOptions, RETRYABLE_CODES };

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: queryRetryOptions,
		mutations: {
			retry: false, // mutations do not retry, they are expected to be successful or not
		},
	},
	queryCache: new QueryCache({
		onError: (error, query) => {
			toast.error(
				error.message ?? "Something went wrong. Please try again later.",
				{
					action: {
						label: "Retry",
						onClick: () => query.invalidate(),
					},
				},
			);
		},
	}),
	mutationCache: new MutationCache({
		onError: (error) => {
			toast.error(
				error.message ?? "Something went wrong. Please try again later.",
			);
		},
	}),
});
