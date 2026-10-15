import { isClerkAPIResponseError } from "@clerk/expo";

export function getClerkErrorMessage(error: unknown): string {
	if (isClerkAPIResponseError(error)) {
		return (
			error.errors[0]?.longMessage ??
			error.errors[0]?.message ??
			"Request failed"
		);
	}
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return "Something went wrong. Please try again.";
}
