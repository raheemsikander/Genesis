import { ORPCError } from "@orpc/client";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const RETRYABLE_CODES = new Set([
	"TIMEOUT",
	"INTERNAL_SERVER_ERROR",
	"BAD_GATEWAY",
	"SERVICE_UNAVAILABLE",
	"GATEWAY_TIMEOUT",
	"TOO_MANY_REQUESTS",
]);

export function isRetryableError(error: unknown): boolean {
	if (error instanceof ORPCError) {
		return RETRYABLE_CODES.has(error.code);
	}
	return true;
}

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: (failureCount, error) => {
				if (!isRetryableError(error)) return false;
				return failureCount < 3;
			},
			retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // exponential backoff, up to 30 seconds
			staleTime: 30 * 1000, // 30 seconds, items are considered fresh for 30 seconds
			gcTime: 5 * 60 * 1000, // 5 minutes, items are considered stale after 5 minutes
		},
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
