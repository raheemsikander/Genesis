import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * These tests exercise the real t3-env schema, so they must defeat the CI escape hatch
 * (`skipValidation: process.env.CI === "true"`) or they would silently pass in CI.
 */
function stubRequiredEnv(): void {
	vi.stubEnv("CI", "");
	vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://api.example.com");
	vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_example");
	vi.stubEnv("NEXT_PUBLIC_CLERK_SIGN_IN_URL", "/sign-in");
	vi.stubEnv("NEXT_PUBLIC_CLERK_SIGN_UP_URL", "/sign-up");
}

beforeEach(() => {
	vi.resetModules();
	stubRequiredEnv();
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("NEXT_PUBLIC_GA4_MEASUREMENT_ID validation", () => {
	it("AC1 — accepts a GA4 measurement ID", async () => {
		vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "G-AB12CD34EF");
		const { env } = await import("./env");
		expect(env.NEXT_PUBLIC_GA4_MEASUREMENT_ID).toBe("G-AB12CD34EF");
	});

	it("AC1 — is optional, so an unset value leaves analytics disabled", async () => {
		vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "");
		const { env } = await import("./env");
		expect(env.NEXT_PUBLIC_GA4_MEASUREMENT_ID).toBeUndefined();
	});

	/**
	 * The format check lives in google-analytics.ts, not here: this schema is also evaluated in
	 * the browser, where a throw over an optional analytics var would white-screen every page.
	 */
	it("F7: a malformed value passes validation instead of breaking the app", async () => {
		vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "GTM-ABC123");
		const { env } = await import("./env");
		expect(env.NEXT_PUBLIC_GA4_MEASUREMENT_ID).toBe("GTM-ABC123");
	});
});
