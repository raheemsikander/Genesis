import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/errors", () => ({
	isClerkAPIResponseError: (err: unknown) =>
		err !== null &&
		typeof err === "object" &&
		(err as Record<string, unknown>).clerkError === true,
}));

import { getClerkErrorMessage } from "./clerk-error";

function makeClerkAPIError(
	errors: { longMessage?: string; message?: string }[],
) {
	return { clerkError: true, errors };
}

describe("getClerkErrorMessage", () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	it("ClerkAPIResponseError with longMessage returns longMessage", () => {
		const err = makeClerkAPIError([
			{ longMessage: "Long msg", message: "Short msg" },
		]);
		expect(getClerkErrorMessage(err, "fallback")).toBe("Long msg");
		expect(consoleErrorSpy).not.toHaveBeenCalled();
	});

	it("ClerkAPIResponseError with only message returns message", () => {
		const err = makeClerkAPIError([{ message: "Short msg" }]);
		expect(getClerkErrorMessage(err, "fallback")).toBe("Short msg");
		expect(consoleErrorSpy).not.toHaveBeenCalled();
	});

	it("ClerkAPIResponseError with empty errors array returns fallback", () => {
		const err = makeClerkAPIError([]);
		expect(getClerkErrorMessage(err, "fallback")).toBe("fallback");
		expect(consoleErrorSpy).toHaveBeenCalledOnce();
	});

	it("plain Clerk-shaped object with code + longMessage returns longMessage", () => {
		const err = {
			code: "form_password_incorrect",
			longMessage: "Wrong password.",
			message: "Short",
		};
		expect(getClerkErrorMessage(err, "fallback")).toBe("Wrong password.");
		expect(consoleErrorSpy).not.toHaveBeenCalled();
	});

	it("plain Clerk-shaped object with code + message but no longMessage returns message", () => {
		const err = {
			code: "form_identifier_not_found",
			message: "No account found.",
		};
		expect(getClerkErrorMessage(err, "fallback")).toBe("No account found.");
		expect(consoleErrorSpy).not.toHaveBeenCalled();
	});

	it("Clerk-shaped object with empty-string longMessage and a message returns message", () => {
		const err = {
			code: "some_code",
			longMessage: "",
			message: "Actual message.",
		};
		expect(getClerkErrorMessage(err, "fallback")).toBe("Actual message.");
		expect(consoleErrorSpy).not.toHaveBeenCalled();
	});

	it("non-Clerk Error returns fallback and calls console.error", () => {
		const err = new TypeError("Cannot read properties of undefined");
		expect(getClerkErrorMessage(err, "fallback")).toBe("fallback");
		expect(consoleErrorSpy).toHaveBeenCalledOnce();
	});

	it("null returns fallback and calls console.error", () => {
		expect(getClerkErrorMessage(null, "fallback")).toBe("fallback");
		expect(consoleErrorSpy).toHaveBeenCalledOnce();
	});

	it("undefined returns fallback and calls console.error", () => {
		expect(getClerkErrorMessage(undefined, "fallback")).toBe("fallback");
		expect(consoleErrorSpy).toHaveBeenCalledOnce();
	});

	it("string input returns fallback and calls console.error", () => {
		expect(getClerkErrorMessage("some error string", "fallback")).toBe(
			"fallback",
		);
		expect(consoleErrorSpy).toHaveBeenCalledOnce();
	});
});
