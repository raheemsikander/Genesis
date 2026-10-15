import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "ga_campaign";

async function importUtm() {
	return await import("./utm");
}

beforeEach(() => {
	vi.resetModules();
	window.sessionStorage.clear();
	window.localStorage.clear();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("readCampaignParams", () => {
	it("AC6 — maps every utm_* param to its GA4 campaign_* name", async () => {
		const { readCampaignParams } = await importUtm();
		expect(
			readCampaignParams(
				"utm_id=123&utm_source=newsletter&utm_medium=email&utm_campaign=spring_launch&utm_term=running+shoes&utm_content=header_link",
			),
		).toEqual({
			campaign_id: "123",
			campaign_source: "newsletter",
			campaign_medium: "email",
			campaign_name: "spring_launch",
			campaign_term: "running shoes",
			campaign_content: "header_link",
		});
	});

	it("E1 — returns only the params that are present", async () => {
		const { readCampaignParams } = await importUtm();
		expect(readCampaignParams("utm_source=twitter")).toEqual({
			campaign_source: "twitter",
		});
	});

	it("E2 — treats an empty utm value as absent", async () => {
		const { readCampaignParams } = await importUtm();
		expect(readCampaignParams("utm_source=&utm_medium=email")).toEqual({
			campaign_medium: "email",
		});
	});

	it("E3 — ignores query params that are not utm_*", async () => {
		const { readCampaignParams } = await importUtm();
		expect(readCampaignParams("utm_source=x&ref=abc&page=2")).toEqual({
			campaign_source: "x",
		});
	});

	it("E4 — parses identically with and without a leading question mark", async () => {
		const { readCampaignParams } = await importUtm();
		expect(readCampaignParams("?utm_source=x")).toEqual(
			readCampaignParams("utm_source=x"),
		);
	});

	it("E8 — decodes percent-encoded values", async () => {
		const { readCampaignParams } = await importUtm();
		expect(readCampaignParams("utm_campaign=spring%20launch")).toEqual({
			campaign_name: "spring launch",
		});
	});

	it("H6 — returns nothing for a query string with no campaign params", async () => {
		const { readCampaignParams } = await importUtm();
		expect(readCampaignParams("")).toEqual({});
	});
});

describe("resolveCampaignParams", () => {
	it("H1 — returns the campaign params of a utm-bearing query", async () => {
		const { resolveCampaignParams } = await importUtm();
		expect(resolveCampaignParams("utm_source=newsletter")).toEqual({
			campaign_source: "newsletter",
		});
	});

	it("H2 / AC7 — a later query with no utm params still resolves to the stored campaign", async () => {
		const { resolveCampaignParams } = await importUtm();
		resolveCampaignParams("utm_source=newsletter&utm_medium=email");
		expect(resolveCampaignParams("")).toEqual({
			campaign_source: "newsletter",
			campaign_medium: "email",
		});
	});

	it("AC7 — persists to sessionStorage, not localStorage", async () => {
		const { resolveCampaignParams } = await importUtm();
		resolveCampaignParams("utm_source=newsletter");
		expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain("newsletter");
		expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
	});

	it("H7 — a second campaign link replaces the stored campaign", async () => {
		const { resolveCampaignParams } = await importUtm();
		resolveCampaignParams("utm_source=newsletter&utm_medium=email");
		expect(
			resolveCampaignParams("utm_source=twitter&utm_medium=social"),
		).toEqual({ campaign_source: "twitter", campaign_medium: "social" });
		expect(resolveCampaignParams("")).toEqual({
			campaign_source: "twitter",
			campaign_medium: "social",
		});
	});

	it("H7 — the replacement is total: params the new campaign omits do not survive", async () => {
		const { resolveCampaignParams } = await importUtm();
		resolveCampaignParams("utm_source=newsletter&utm_medium=email");
		expect(resolveCampaignParams("utm_source=twitter")).toEqual({
			campaign_source: "twitter",
		});
		expect(resolveCampaignParams("")).toEqual({ campaign_source: "twitter" });
	});

	it.each([
		"gclid",
		"gbraid",
		"wbraid",
		"dclid",
	])("treats a %s landing as its own touch and clears the stored campaign", async (clickId) => {
		const { resolveCampaignParams } = await importUtm();
		resolveCampaignParams("utm_source=newsletter");
		// GA4 resolves the click ID itself out of page_location; reasserting the newsletter
		// would attribute the paid click to it.
		expect(resolveCampaignParams(`${clickId}=abc123`)).toEqual({});
		expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe("{}");
		expect(resolveCampaignParams("")).toEqual({});
	});

	it("E9 — a non-campaign query does not clear the stored campaign", async () => {
		const { resolveCampaignParams } = await importUtm();
		resolveCampaignParams("utm_source=newsletter");
		expect(resolveCampaignParams("page=2")).toEqual({
			campaign_source: "newsletter",
		});
	});

	it("H6 — resolves to nothing when no campaign was ever seen", async () => {
		const { resolveCampaignParams } = await importUtm();
		expect(resolveCampaignParams("page=2")).toEqual({});
	});

	it("F2 — falls back to memory when sessionStorage.setItem throws", async () => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("QuotaExceededError");
		});
		const { resolveCampaignParams } = await importUtm();
		expect(() => resolveCampaignParams("utm_source=newsletter")).not.toThrow();
		expect(resolveCampaignParams("")).toEqual({
			campaign_source: "newsletter",
		});
	});

	it("F2 — falls back to memory when sessionStorage.getItem throws", async () => {
		const { resolveCampaignParams } = await importUtm();
		resolveCampaignParams("utm_source=newsletter");
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("SecurityError");
		});
		expect(resolveCampaignParams("")).toEqual({
			campaign_source: "newsletter",
		});
	});

	it("F2 — survives a sessionStorage that throws on the very first read", async () => {
		// Safari private mode and cookie-blocked iframes throw on access, before this page
		// has written anything of its own to fall back on.
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("SecurityError");
		});
		const { resolveCampaignParams } = await importUtm();
		expect(resolveCampaignParams("page=2")).toEqual({});
	});

	it("F2 — mirrors a campaign it only ever read, so a later read failure cannot drop it", async () => {
		// The campaign was stored by an earlier page load, so this module instance never wrote
		// it: the mirror has to be populated on the successful read.
		window.sessionStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ campaign_source: "newsletter" }),
		);
		const { resolveCampaignParams } = await importUtm();
		expect(resolveCampaignParams("")).toEqual({
			campaign_source: "newsletter",
		});

		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("SecurityError");
		});
		expect(resolveCampaignParams("")).toEqual({
			campaign_source: "newsletter",
		});
	});

	it("F3 — treats malformed stored JSON as no stored campaign", async () => {
		window.sessionStorage.setItem(STORAGE_KEY, "{not json");
		const { resolveCampaignParams } = await importUtm();
		expect(resolveCampaignParams("")).toEqual({});
	});

	it("F2 — a click-id clear that storage refuses to persist still holds in memory", async () => {
		const { resolveCampaignParams } = await importUtm();
		resolveCampaignParams("utm_source=newsletter");
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("SecurityError");
		});
		expect(resolveCampaignParams("gclid=abc123")).toEqual({});
		expect(resolveCampaignParams("")).toEqual({});
	});
});

describe("resolveCampaignTagState", () => {
	it("names every campaign key, so a narrowed campaign clears the ones it dropped", async () => {
		const { resolveCampaignTagState } = await importUtm();
		resolveCampaignTagState("utm_source=newsletter&utm_medium=email");
		expect(resolveCampaignTagState("utm_source=twitter")).toEqual({
			campaign_id: null,
			campaign_source: "twitter",
			campaign_medium: null,
			campaign_name: null,
			campaign_term: null,
			campaign_content: null,
		});
	});
});

describe("isAttributionParam", () => {
	it.each([
		"utm_source",
		"utm_medium",
		"utm_anything",
		"gclid",
		"gbraid",
		"wbraid",
		"dclid",
	])("keeps %s, which GA4 reads for attribution", async (key) => {
		const { isAttributionParam } = await importUtm();
		expect(isAttributionParam(key)).toBe(true);
	});

	it.each([
		"email",
		"__clerk_ticket",
		"redirect_url",
		"UTM_SOURCE",
		"ref",
	])("drops %s", async (key) => {
		const { isAttributionParam } = await importUtm();
		expect(isAttributionParam(key)).toBe(false);
	});
});
