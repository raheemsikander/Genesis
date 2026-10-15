import { isClerkAPIResponseError } from "@clerk/expo";

const FALLBACK = "Something went wrong. Please try again.";

/**
 * Extracts a human-readable message from a Clerk error.
 *
 * Handles two shapes (mirrors apps/web/src/utils/clerk-error.ts):
 * - ClerkAPIResponseError: thrown by Clerk SDK methods, has an `errors` array
 * - Single error object: returned inline by some Clerk methods, has longMessage/message
 */
export function getClerkErrorMessage(error: unknown): string {
	if (isClerkAPIResponseError(error)) {
		const first = error.errors[0];
		if (first) {
			return first.longMessage ?? first.message ?? FALLBACK;
		}
	}

	if (error !== null && typeof error === "object") {
		/**
		 * Only trust messages from Clerk-shaped errors (they carry a string
		 * `code`). A bare TypeError or network Error also has `.message`, but
		 * that text is internal and must not surface to users.
		 */
		const e = error as Record<string, unknown>;
		if (typeof e.code === "string") {
			if (typeof e.longMessage === "string" && e.longMessage) {
				return e.longMessage;
			}
			if (typeof e.message === "string" && e.message) {
				return e.message;
			}
		}
	}

	console.error("getClerkErrorMessage: unrecognized error shape", error);
	return FALLBACK;
}
