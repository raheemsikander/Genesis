import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the env module so each describe block controls NEXT_PUBLIC_GA4_MEASUREMENT_ID without
// going through t3-env's runtime validation of every required var.
const envMock = vi.hoisted(() => ({
	NEXT_PUBLIC_GA4_MEASUREMENT_ID: undefined as string | undefined,
}));

vi.mock("./env", () => ({
	env: envMock,
}));

type TestWindow = Window & {
	dataLayer?: unknown[];
	gtag?: (...args: unknown[]) => void;
};

function testWindow(): TestWindow {
	return window as TestWindow;
}

/** gtag.js queues raw `arguments` objects; normalise them to arrays for assertions. */
function gtagCalls(): unknown[][] {
	return (testWindow().dataLayer ?? []).map((entry) =>
		Array.from(entry as ArrayLike<unknown>),
	);
}

function callsOfType(command: string): unknown[][] {
	return gtagCalls().filter((call) => call[0] === command);
}

function pageViewEvents(): Record<string, unknown>[] {
	return callsOfType("event")
		.filter((call) => call[1] === "page_view")
		.map((call) => call[2] as Record<string, unknown>);
}

/**
 * The tag-scope state GA4 reads `campaign_*` and the page identity from. Asserts the config
 * exists first, so an absence check below cannot pass by there being no config at all.
 */
function configParams(): Record<string, unknown> {
	const config = callsOfType("config")[0];
	expect(config).toBeDefined();
	return config?.[2] as Record<string, unknown>;
}

function pageStateSets(): Record<string, unknown>[] {
	return callsOfType("set")
		.map((call) => call[1] as Record<string, unknown>)
		.filter((params) => params.page_location !== undefined);
}

/** Every `campaign_*` key the tag was given a non-null value for, across the whole queue. */
function attributedCampaignKeys(): string[] {
	const keys = gtagCalls()
		.flatMap((call) =>
			call.filter((arg) => arg !== null && typeof arg === "object"),
		)
		.flatMap((params) => Object.entries(params as Record<string, unknown>))
		.filter(([key, value]) => key.startsWith("campaign_") && value !== null)
		.map(([key]) => key);

	return [...new Set(keys)].sort();
}

/** gtag's `set` merges, so every campaign key is named on every route change. */
const CLEARED_CAMPAIGN = {
	campaign_id: null,
	campaign_source: null,
	campaign_medium: null,
	campaign_name: null,
	campaign_term: null,
	campaign_content: null,
};

function stubReferrer(referrer: string): void {
	Object.defineProperty(document, "referrer", {
		value: referrer,
		configurable: true,
	});
}

beforeEach(() => {
	vi.resetModules();
	window.sessionStorage.clear();
	window.history.replaceState({}, "", "/");
	stubReferrer("");
	testWindow().dataLayer = undefined;
	testWindow().gtag = undefined;
	document.title = "Test page";
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("google analytics (no measurement id configured)", () => {
	beforeEach(() => {
		envMock.NEXT_PUBLIC_GA4_MEASUREMENT_ID = undefined;
	});

	it("AC2 — reports the integration as disabled and exposes no script source", async () => {
		const { isGoogleAnalyticsEnabled, googleAnalyticsScriptSrc } = await import(
			"./google-analytics"
		);
		expect(isGoogleAnalyticsEnabled()).toBe(false);
		expect(googleAnalyticsScriptSrc()).toBeNull();
	});

	it("AC2 / F1 — every tracking call is a no-op that never creates a dataLayer", async () => {
		const { googleAnalytics } = await import("./google-analytics");
		googleAnalytics.init();
		googleAnalytics.trackPageView("/", "utm_source=newsletter");
		googleAnalytics.trackEvent("cta_clicked", { location: "hero" });
		googleAnalytics.setUserId("user_123");
		expect(testWindow().dataLayer).toBeUndefined();
	});
});

describe.each([
	["a Tag Manager container id", "GTM-ABC123"],
	["a Universal Analytics property id", "UA-12345-1"],
	["a data stream id", "1234567890"],
	["a lowercased measurement id", "g-ab12cd34ef"],
])("google analytics (%s configured)", (_label, value) => {
	beforeEach(() => {
		envMock.NEXT_PUBLIC_GA4_MEASUREMENT_ID = value;
	});

	it("F7: stays off rather than sending hits to a destination that cannot exist", async () => {
		const {
			isGoogleAnalyticsEnabled,
			googleAnalyticsScriptSrc,
			googleAnalytics,
		} = await import("./google-analytics");
		expect(isGoogleAnalyticsEnabled()).toBe(false);
		expect(googleAnalyticsScriptSrc()).toBeNull();

		googleAnalytics.init();
		googleAnalytics.trackPageView("/", "");
		expect(testWindow().dataLayer).toBeUndefined();
	});
});

describe("google analytics (measurement id configured)", () => {
	beforeEach(() => {
		envMock.NEXT_PUBLIC_GA4_MEASUREMENT_ID = "G-TEST12345";
	});

	it("AC2 — reports the integration as enabled and builds the gtag.js source", async () => {
		const { isGoogleAnalyticsEnabled, googleAnalyticsScriptSrc } = await import(
			"./google-analytics"
		);
		expect(isGoogleAnalyticsEnabled()).toBe(true);
		expect(googleAnalyticsScriptSrc()).toBe(
			"https://www.googletagmanager.com/gtag/js?id=G-TEST12345",
		);
	});

	it("AC3 — init() pushes the js timestamp then the config, with automatic pageviews off", async () => {
		const { googleAnalytics } = await import("./google-analytics");
		googleAnalytics.init();
		const [js, config] = gtagCalls();
		expect(js?.[0]).toBe("js");
		expect(js?.[1]).toBeInstanceOf(Date);
		expect(config).toEqual([
			"config",
			"G-TEST12345",
			{
				send_page_view: false,
				page_location: `${window.location.origin}/`,
				page_referrer: "",
			},
		]);
	});

	it("AC4 — init() is idempotent", async () => {
		const { googleAnalytics } = await import("./google-analytics");
		googleAnalytics.init();
		googleAnalytics.init();
		googleAnalytics.init();
		expect(callsOfType("config")).toHaveLength(1);
	});

	it("AC5 / AC6 / H1 — a pageview reports GA4's own page fields and nothing else", async () => {
		const { googleAnalytics } = await import("./google-analytics");
		googleAnalytics.init();
		googleAnalytics.trackPageView("/pricing", "utm_source=newsletter");
		// `page_path` and `page_title` are deliberately absent: the first is a Universal
		// Analytics field GA4 ignores, the second is read off `document.title` at send time
		// because route metadata lands there asynchronously.
		expect(pageViewEvents()).toEqual([
			{
				page_location: `${window.location.origin}/pricing?utm_source=newsletter`,
				page_referrer: "",
			},
		]);
	});

	it("AC6 — the campaign params reach GA4 at tag scope, where attribution is resolved", async () => {
		const { googleAnalytics } = await import("./google-analytics");
		googleAnalytics.init();
		googleAnalytics.trackPageView(
			"/pricing",
			"utm_source=newsletter&utm_medium=email",
		);
		expect(pageStateSets()[0]).toEqual({
			page_location: `${window.location.origin}/pricing?utm_source=newsletter&utm_medium=email`,
			page_referrer: "",
			...CLEARED_CAMPAIGN,
			campaign_source: "newsletter",
			campaign_medium: "email",
		});
	});

	it("clears the campaign keys a narrowed campaign no longer carries", async () => {
		const { googleAnalytics } = await import("./google-analytics");
		googleAnalytics.init();
		googleAnalytics.trackPageView(
			"/",
			"utm_source=newsletter&utm_medium=email&utm_campaign=launch",
		);
		googleAnalytics.trackPageView("/pricing", "utm_source=twitter");

		// gtag's `set` merges, so leaving campaign_medium/campaign_name out here would pin the
		// newsletter's values to a twitter campaign that never had them.
		expect(pageStateSets()[1]).toMatchObject({
			campaign_source: "twitter",
			campaign_medium: null,
			campaign_name: null,
		});
	});

	it("lets GA4 resolve a click-id landing itself instead of reasserting an earlier campaign", async () => {
		const { googleAnalytics } = await import("./google-analytics");
		googleAnalytics.init();
		googleAnalytics.trackPageView("/", "utm_source=newsletter");
		googleAnalytics.trackPageView("/pricing", "gclid=abc123");

		expect(pageStateSets()[1]).toEqual({
			page_location: `${window.location.origin}/pricing?gclid=abc123`,
			page_referrer: "",
			...CLEARED_CAMPAIGN,
		});
	});

	it("AC6 — a landing url's campaign is already on the config command", async () => {
		window.history.replaceState(
			{},
			"",
			"/?utm_source=newsletter&utm_campaign=launch",
		);

		const { googleAnalytics } = await import("./google-analytics");
		googleAnalytics.init();
		expect(configParams()).toEqual({
			send_page_view: false,
			page_location: `${window.location.origin}/?utm_source=newsletter&utm_campaign=launch`,
			page_referrer: "",
			campaign_source: "newsletter",
			campaign_name: "launch",
		});
	});

	it("keeps auth query strings out of the pageview it sends", async () => {
		const { googleAnalytics } = await import("./google-analytics");
		googleAnalytics.init();
		googleAnalytics.trackPageView(
			"/verify-email",
			"email=invitee%40example.com&__clerk_ticket=eyJhbGciOiJSUzI1NiJ9",
		);
		const [pageView] = pageViewEvents();
		expect(pageView).toMatchObject({
			page_location: `${window.location.origin}/verify-email`,
		});
		expect(JSON.stringify(pageView)).not.toMatch(
			/invitee|__clerk_ticket|eyJhbGciOiJSUzI1NiJ9/,
		);
	});

	it("keeps campaign params but drops everything else sharing the query string", async () => {
		const { googleAnalytics } = await import("./google-analytics");
		googleAnalytics.init();
		googleAnalytics.trackPageView(
			"/",
			"utm_source=newsletter&gclid=abc123&email=invitee%40example.com&redirect_url=%2Fportal",
		);
		expect(pageViewEvents()[0]?.page_location).toBe(
			`${window.location.origin}/?utm_source=newsletter&gclid=abc123`,
		);
	});

	it("configures the tag with a scrubbed location and referrer, so gtag-originated hits carry neither query string", async () => {
		stubReferrer(
			"http://localhost:3000/verify-email?email=invitee%40example.com",
		);
		window.history.replaceState(
			{},
			"",
			"/sign-up?__clerk_ticket=eyJhbGciOiJSUzI1NiJ9",
		);

		const { googleAnalytics } = await import("./google-analytics");
		googleAnalytics.init();

		const [config] = callsOfType("config");
		expect(config?.[2]).toMatchObject({
			page_location: `${window.location.origin}/sign-up`,
			page_referrer: "http://localhost:3000/verify-email",
		});
	});

	it("refreshes the tag's scrubbed page identity on every route change, ahead of the pageview", async () => {
		stubReferrer(
			"http://localhost:3000/verify-email?email=invitee%40example.com",
		);

		const { googleAnalytics } = await import("./google-analytics");
		googleAnalytics.init();
		googleAnalytics.trackPageView("/portal", "redirect_url=%2Fportal%2Fusers");

		const commands = gtagCalls();
		const setIndex = commands.findIndex(
			(call) =>
				call[0] === "set" &&
				(call[1] as Record<string, unknown>).page_location !== undefined,
		);
		const eventIndex = commands.findIndex((call) => call[1] === "page_view");
		expect(setIndex).toBeGreaterThanOrEqual(0);
		expect(setIndex).toBeLessThan(eventIndex);
		expect(commands[setIndex]?.[1]).toEqual({
			page_location: `${window.location.origin}/portal`,
			page_referrer: "http://localhost:3000/verify-email",
			...CLEARED_CAMPAIGN,
		});
	});

	it('reads a non-http referrer as direct rather than as the string "null"', async () => {
		stubReferrer("android-app://com.google.android.gm/");

		const { googleAnalytics } = await import("./google-analytics");
		googleAnalytics.init();
		googleAnalytics.trackPageView("/pricing", "");

		expect(configParams().page_referrer).toBe("");
		expect(pageStateSets()[0]?.page_referrer).toBe("");
		expect(pageViewEvents()[0]?.page_referrer).toBe("");
	});

	it("H2 — a later route change with no utm params keeps the session's campaign on the tag", async () => {
		const { googleAnalytics } = await import("./google-analytics");
		googleAnalytics.init();
		googleAnalytics.trackPageView("/", "utm_source=newsletter");
		googleAnalytics.trackPageView("/sign-up", "");
		expect(pageStateSets()[1]).toEqual({
			page_location: `${window.location.origin}/sign-up`,
			page_referrer: "",
			...CLEARED_CAMPAIGN,
			campaign_source: "newsletter",
		});
	});

	it("H6 — a session with no campaign attributes no campaign anywhere in the queue", async () => {
		const { googleAnalytics } = await import("./google-analytics");
		googleAnalytics.init();
		googleAnalytics.trackPageView("/", "");
		googleAnalytics.trackEvent("cta_clicked", { location: "hero" });
		expect(configParams()).not.toHaveProperty("campaign_source");
		expect(attributedCampaignKeys()).toEqual([]);
	});

	it("AC6 — the campaign is attributed at tag scope and nowhere else", async () => {
		const { googleAnalytics } = await import("./google-analytics");
		googleAnalytics.init();
		googleAnalytics.trackPageView("/", "utm_source=newsletter");
		expect(attributedCampaignKeys()).toEqual(["campaign_source"]);
		expect(pageViewEvents()[0]).not.toHaveProperty("campaign_source");
	});

	it("E5 — the same url tracked twice sends one pageview", async () => {
		const { googleAnalytics } = await import("./google-analytics");
		googleAnalytics.init();
		googleAnalytics.trackPageView("/pricing", "");
		googleAnalytics.trackPageView("/pricing", "");
		expect(pageViewEvents()).toHaveLength(1);
	});

	it("E6 — the same pathname with a different query sends two pageviews", async () => {
		const { googleAnalytics } = await import("./google-analytics");
		googleAnalytics.init();
		googleAnalytics.trackPageView("/search", "a=1");
		googleAnalytics.trackPageView("/search", "a=2");
		expect(pageViewEvents()).toHaveLength(2);
	});

	it("H8 — a custom event carries exactly its own params, campaign attribution coming off the tag", async () => {
		const { googleAnalytics } = await import("./google-analytics");
		googleAnalytics.init();
		googleAnalytics.trackPageView("/", "utm_source=newsletter");
		googleAnalytics.trackEvent("cta_clicked", { location: "hero" });
		const custom = callsOfType("event").find(
			(call) => call[1] === "cta_clicked",
		);
		expect(custom?.[2]).toEqual({ location: "hero" });
	});

	it("AC8 — setUserId sets and clears the GA4 user id", async () => {
		const { googleAnalytics } = await import("./google-analytics");
		googleAnalytics.init();
		googleAnalytics.setUserId("user_123");
		googleAnalytics.setUserId(null);
		expect(callsOfType("set")).toEqual([
			["set", { user_id: "user_123" }],
			["set", { user_id: null }],
		]);
	});

	it("E7 / F5 / F6 — a command sent before init() still queues behind a config", async () => {
		const { googleAnalytics } = await import("./google-analytics");
		// gtag.js is never loaded here, so nothing drains the queue: exactly the ad-blocker
		// and afterInteractive-not-yet-fired cases.
		googleAnalytics.trackEvent("cta_clicked", { location: "hero" });
		const commands = gtagCalls().map((call) => String(call[0]));
		expect(commands.indexOf("config")).toBeLessThan(commands.indexOf("event"));
	});

	it("E7 — queued entries are raw arguments objects, as gtag.js requires", async () => {
		const { googleAnalytics } = await import("./google-analytics");
		googleAnalytics.init();
		const [first] = testWindow().dataLayer ?? [];
		expect(Array.isArray(first)).toBe(false);
		expect(first).toHaveProperty("length");
	});

	it("F4 — every call is a no-op outside the browser", async () => {
		const { googleAnalytics } = await import("./google-analytics");
		vi.stubGlobal("window", undefined);
		expect(() => {
			googleAnalytics.init();
			googleAnalytics.trackPageView("/", "");
			googleAnalytics.trackEvent("cta_clicked");
			googleAnalytics.setUserId("user_123");
		}).not.toThrow();
	});
});
