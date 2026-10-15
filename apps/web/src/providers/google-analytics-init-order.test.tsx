import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "../../tests/helpers/clerk.test-helper";

/**
 * Unlike google-analytics-provider.test.tsx, this file drives the REAL analytics service so the
 * order commands reach the gtag queue is observable. React runs child effects before parent
 * effects, which is exactly where a pageview can outrun the tag it belongs to.
 */
const envMock = vi.hoisted(() => ({
	NEXT_PUBLIC_GA4_MEASUREMENT_ID: "G-TEST12345" as string | undefined,
}));

vi.mock("../utils/env", () => ({ env: envMock }));

vi.mock("next/navigation", () => ({
	usePathname: () => "/",
	useSearchParams: () => new URLSearchParams("utm_source=newsletter"),
}));

vi.mock("next/script", () => ({
	default: ({ src }: { src: string }) => <script src={src} />,
}));

type TestWindow = Window & { dataLayer?: unknown[]; gtag?: unknown };

function queuedCommands(): string[] {
	const layer = (window as TestWindow).dataLayer ?? [];
	return layer.map((entry) => {
		const call = Array.from(entry as ArrayLike<unknown>);
		return call[0] === "event" ? `event:${String(call[1])}` : String(call[0]);
	});
}

beforeEach(() => {
	vi.resetModules();
	window.sessionStorage.clear();
	(window as TestWindow).dataLayer = undefined;
	(window as TestWindow).gtag = undefined;
});

describe("GA4 command ordering on first paint", () => {
	it("H1 — the landing page_view is queued after the config that gives it a destination", async () => {
		const { GoogleAnalyticsProvider } = await import(
			"./google-analytics-provider"
		);
		render(<GoogleAnalyticsProvider>{null}</GoogleAnalyticsProvider>);

		const commands = queuedCommands();
		expect(commands).toContain("event:page_view");
		expect(commands.indexOf("config")).toBeLessThan(
			commands.indexOf("event:page_view"),
		);
	});

	it("H1 — the landing page identity and its campaign both reach the tag", async () => {
		const { GoogleAnalyticsProvider } = await import(
			"./google-analytics-provider"
		);
		render(<GoogleAnalyticsProvider>{null}</GoogleAnalyticsProvider>);

		const calls = ((window as TestWindow).dataLayer ?? []).map((entry) =>
			Array.from(entry as ArrayLike<unknown>),
		);

		const pageView = calls.find(
			(call) => call[0] === "event" && call[1] === "page_view",
		);
		expect(pageView?.[2]).toEqual({
			page_location: `${window.location.origin}/?utm_source=newsletter`,
			page_referrer: "",
		});

		// GA4 resolves attribution from tag-scope state, so that is where campaign_* has to land.
		const pageState = calls.find(
			(call) =>
				call[0] === "set" &&
				(call[1] as Record<string, unknown>).page_location !== undefined,
		);
		expect(pageState?.[1]).toMatchObject({ campaign_source: "newsletter" });
	});
});
