import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock mixpanel-browser so we can assert against it without ever hitting the
// network or relying on the real SDK's init flow.
const mockMixpanel = {
	init: vi.fn(),
	track: vi.fn(),
	identify: vi.fn(),
	register: vi.fn(),
	reset: vi.fn(),
	people: { set: vi.fn() },
};

vi.mock("mixpanel-browser", () => ({
	default: mockMixpanel,
}));

// Mock the env module so each describe block can control NEXT_PUBLIC_MIXPANEL_TOKEN
// without going through t3-env's runtime validation of every required var.
const envMock = vi.hoisted(() => ({
	NEXT_PUBLIC_MIXPANEL_TOKEN: "" as string | undefined,
	NEXT_PUBLIC_NODE_ENV: "development" as
		| "development"
		| "staging"
		| "production",
}));

vi.mock("./env", () => ({
	env: envMock,
}));

// Mock the rollbar singleton so the failure path can be asserted without
// instantiating the real Rollbar SDK or hitting the network.
const mockRollbar = {
	warning: vi.fn(),
};

vi.mock("./rollbar", () => ({
	rollbar: mockRollbar,
}));

function resetAllMocks() {
	mockMixpanel.init.mockReset();
	mockMixpanel.track.mockReset();
	mockMixpanel.identify.mockReset();
	mockMixpanel.register.mockReset();
	mockMixpanel.reset.mockReset();
	mockMixpanel.people.set.mockReset();
	mockRollbar.warning.mockReset();
	vi.resetModules();
}

describe("AnalyticsService (no token configured)", () => {
	beforeEach(() => {
		envMock.NEXT_PUBLIC_MIXPANEL_TOKEN = undefined;
		envMock.NEXT_PUBLIC_NODE_ENV = "development";
		resetAllMocks();
	});

	it("H11 / F1 — does not call mixpanel.init when token is unset", async () => {
		const { analytics } = await import("./analytics");
		analytics.init();
		expect(mockMixpanel.init).not.toHaveBeenCalled();
	});

	it("H11 / F1 — track / identify / setUserProperties / reset / registerSuperProperties all no-op when token is unset", async () => {
		const { analytics } = await import("./analytics");
		analytics.init();
		analytics.track("Sign In", { method: "password" });
		analytics.identify("user_123");
		analytics.setUserProperties({ $email: "a@b.com" });
		analytics.reset();
		analytics.registerSuperProperties({ foo: "bar" });
		expect(mockMixpanel.track).not.toHaveBeenCalled();
		expect(mockMixpanel.identify).not.toHaveBeenCalled();
		expect(mockMixpanel.people.set).not.toHaveBeenCalled();
		expect(mockMixpanel.reset).not.toHaveBeenCalled();
		expect(mockMixpanel.register).not.toHaveBeenCalled();
	});
});

describe("AnalyticsService (token configured)", () => {
	beforeEach(() => {
		envMock.NEXT_PUBLIC_MIXPANEL_TOKEN = "test-token-abc";
		envMock.NEXT_PUBLIC_NODE_ENV = "staging";
		resetAllMocks();
	});

	it("H1 — init() calls mixpanel.init with the token and the documented config (track_pageview, persistence, replay options)", async () => {
		const { analytics } = await import("./analytics");
		analytics.init();
		expect(mockMixpanel.init).toHaveBeenCalledTimes(1);
		const [token, config] = mockMixpanel.init.mock.calls[0] ?? [];
		expect(token).toBe("test-token-abc");
		expect(config).toMatchObject({
			track_pageview: "url-with-path-and-query-string",
			persistence: "localStorage",
			api_transport: "sendBeacon",
			record_sessions_percent: 50,
			record_idle_timeout_ms: 900_000,
			record_max_ms: 900_000,
			record_mask_text_class: "mp-mask",
		});
	});

	it("H1 / AC7 — init() registers super property environment", async () => {
		const { analytics } = await import("./analytics");
		analytics.init();
		expect(mockMixpanel.register).toHaveBeenCalledWith(
			expect.objectContaining({
				environment: "staging",
			}),
		);
	});

	it("E1 / E3 — init() is idempotent: calling it N times runs mixpanel.init exactly once", async () => {
		const { analytics } = await import("./analytics");
		analytics.init();
		analytics.init();
		analytics.init();
		expect(mockMixpanel.init).toHaveBeenCalledTimes(1);
	});

	it("H1 — track(name, properties) forwards to mixpanel.track once initialized", async () => {
		const { analytics, AnalyticsEvent } = await import("./analytics");
		analytics.init();
		analytics.track(AnalyticsEvent.SIGN_IN, { method: "password" });
		expect(mockMixpanel.track).toHaveBeenCalledWith("Sign In", {
			method: "password",
		});
	});

	it("H8 / AC3 — identify(userId) forwards to mixpanel.identify", async () => {
		const { analytics } = await import("./analytics");
		analytics.init();
		analytics.identify("user_123");
		expect(mockMixpanel.identify).toHaveBeenCalledWith("user_123");
	});

	it("H8 / AC3 — setUserProperties forwards to mixpanel.people.set", async () => {
		const { analytics } = await import("./analytics");
		analytics.init();
		analytics.setUserProperties({
			$email: "test@example.com",
			$first_name: "Test",
		});
		expect(mockMixpanel.people.set).toHaveBeenCalledWith({
			$email: "test@example.com",
			$first_name: "Test",
		});
	});

	it("AC8 — reset() forwards to mixpanel.reset", async () => {
		const { analytics } = await import("./analytics");
		analytics.init();
		analytics.reset();
		expect(mockMixpanel.reset).toHaveBeenCalledTimes(1);
	});

	it("registerSuperProperties() forwards to mixpanel.register", async () => {
		const { analytics } = await import("./analytics");
		analytics.init();
		mockMixpanel.register.mockClear();
		analytics.registerSuperProperties({ feature_flag_x: "on" });
		expect(mockMixpanel.register).toHaveBeenCalledWith({
			feature_flag_x: "on",
		});
	});

	it("F4 — pre-init track() is a silent no-op (does not throw, does not call mixpanel.track)", async () => {
		const { analytics } = await import("./analytics");
		// note: NOT calling init() — simulating the pre-init dead window
		expect(() => analytics.track("Sign In")).not.toThrow();
		expect(mockMixpanel.track).not.toHaveBeenCalled();
	});

	it("F3 — when mixpanel.init throws, analytics handles it gracefully (no rethrow; subsequent calls no-op) and reports to Rollbar", async () => {
		mockMixpanel.init.mockImplementationOnce(() => {
			throw new Error("simulated SDK init failure");
		});
		const { analytics } = await import("./analytics");
		expect(() => analytics.init()).not.toThrow();
		expect(() => analytics.track("Sign In")).not.toThrow();
		expect(mockMixpanel.track).not.toHaveBeenCalled();
		// Catches a future refactor that swallows the error without logging.
		expect(mockRollbar.warning).toHaveBeenCalledWith(
			"Failed to initialise Mixpanel",
			expect.any(Error),
			expect.objectContaining({ component: "AnalyticsService", op: "init" }),
		);
	});
});

describe("AnalyticsEvent constants", () => {
	beforeEach(() => {
		envMock.NEXT_PUBLIC_MIXPANEL_TOKEN = "test-token-abc";
		resetAllMocks();
	});

	it("H1 — exports the auth event names exactly as Sign In / Sign Up / Sign Out", async () => {
		const { AnalyticsEvent } = await import("./analytics");
		expect(AnalyticsEvent.SIGN_IN).toBe("Sign In");
		expect(AnalyticsEvent.SIGN_UP).toBe("Sign Up");
		expect(AnalyticsEvent.SIGN_OUT).toBe("Sign Out");
	});
});
