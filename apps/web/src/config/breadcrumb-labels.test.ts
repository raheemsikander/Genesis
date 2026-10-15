import { describe, expect, it } from "vitest";
import {
	isUuidShape,
	resolveLabel,
	type StaticLabelMap,
	staticBreadcrumbLabels,
	titleCaseSegment,
} from "./breadcrumb-labels";

describe("isUuidShape", () => {
	it("recognises a canonical v4 UUID", () => {
		expect(isUuidShape("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
	});

	it("is case-insensitive", () => {
		expect(isUuidShape("123E4567-E89B-12D3-A456-426614174000")).toBe(true);
	});

	it("rejects an empty string", () => {
		expect(isUuidShape("")).toBe(false);
	});

	it("rejects non-uuid segments (slugs, numeric ids)", () => {
		expect(isUuidShape("about")).toBe(false);
		expect(isUuidShape("123")).toBe(false);
		expect(isUuidShape("123e4567-e89b-12d3-a456")).toBe(false);
	});
});

describe("titleCaseSegment", () => {
	it("returns an empty string for an empty segment", () => {
		expect(titleCaseSegment("")).toBe("");
	});

	it("title-cases a single word", () => {
		expect(titleCaseSegment("profile")).toBe("Profile");
	});

	it("title-cases a hyphenated slug into space-separated words", () => {
		expect(titleCaseSegment("design-system")).toBe("Design System");
	});

	it("lower-cases the tail of each word", () => {
		expect(titleCaseSegment("ABOUT-US")).toBe("About Us");
	});

	it("drops empty parts from leading/trailing/double hyphens", () => {
		expect(titleCaseSegment("-foo--bar-")).toBe("Foo Bar");
	});
});

describe("staticBreadcrumbLabels", () => {
	it("maps real nav urls to their titles and skips placeholder '#' entries", () => {
		expect(staticBreadcrumbLabels["/portal"]).toBe("Home");
		expect(staticBreadcrumbLabels["/portal/about"]).toBe("About");
		expect(staticBreadcrumbLabels["/portal/email"]).toBe("Email");
		expect(staticBreadcrumbLabels["#"]).toBeUndefined();
	});
});

describe("resolveLabel", () => {
	const staticMap: StaticLabelMap = { "/portal/about": "About" };

	it("prefers an override over the static map", () => {
		const result = resolveLabel({
			segment: "about",
			cumulativePath: "/portal/about",
			overrides: { "/portal/about": "Custom About" },
			staticMap,
		});
		expect(result).toEqual({ kind: "label", value: "Custom About" });
	});

	it("uses an empty-string override (defined but falsy)", () => {
		const result = resolveLabel({
			segment: "about",
			cumulativePath: "/portal/about",
			overrides: { "/portal/about": "" },
			staticMap,
		});
		expect(result).toEqual({ kind: "label", value: "" });
	});

	it("falls back to the static map when no override exists", () => {
		const result = resolveLabel({
			segment: "about",
			cumulativePath: "/portal/about",
			overrides: {},
			staticMap,
		});
		expect(result).toEqual({ kind: "label", value: "About" });
	});

	it("returns a skeleton for an unmapped UUID segment", () => {
		const result = resolveLabel({
			segment: "123e4567-e89b-12d3-a456-426614174000",
			cumulativePath: "/portal/users/123e4567-e89b-12d3-a456-426614174000",
			overrides: {},
			staticMap,
		});
		expect(result).toEqual({ kind: "skeleton" });
	});

	it("title-cases an unmapped non-uuid segment", () => {
		const result = resolveLabel({
			segment: "billing-history",
			cumulativePath: "/portal/billing-history",
			overrides: {},
			staticMap,
		});
		expect(result).toEqual({ kind: "label", value: "Billing History" });
	});
});
