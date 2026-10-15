import { ORPCError } from "@orpc/client";

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

/** Platform-agnostic TanStack Query defaults shared across all clients. */
export const queryRetryOptions = {
	retry: (failureCount: number, error: unknown): boolean => {
		if (!isRetryableError(error)) return false;
		return failureCount < 3;
	},
	retryDelay: (attemptIndex: number): number =>
		Math.min(1000 * 2 ** attemptIndex, 30000),
	// Items are considered fresh for 30 seconds
	staleTime: 30 * 1000,
	// Items are garbage collected after 5 minutes
	gcTime: 5 * 60 * 1000,
} as const;
