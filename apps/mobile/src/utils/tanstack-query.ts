import { ORPCError } from "@orpc/client";
import { QueryClient } from "@tanstack/react-query";

// Retry/backoff config kept in sync with apps/web/src/utils/tanstack-query.ts.
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
			retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
			staleTime: 30 * 1000,
			gcTime: 5 * 60 * 1000,
		},
		mutations: {
			retry: false,
		},
	},
});
