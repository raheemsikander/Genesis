import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	mockAuthenticatedUser,
	mockLoadingUser,
	mockUnauthenticatedUser,
	mockUser,
} from "../../tests/helpers/clerk.test-helper";

const SCRIPT_SRC = "https://www.googletagmanager.com/gtag/js?id=G-TEST12345";

const navigation = vi.hoisted(() => ({
	pathname: "/",
	search: "",
	suspend: false,
}));

vi.mock("next/navigation", () => ({
	usePathname: () => navigation.pathname,
	useSearchParams: () => {
		if (navigation.suspend) {
			// Mimics a component suspending during render, which is what the provider's
			// Suspense boundary exists to contain.
			throw new Promise(() => {});
		}
		return new URLSearchParams(navigation.search);
	},
}));

vi.mock("next/script", () => ({
	default: ({ src, strategy }: { src: string; strategy: string }) => (
		<script data-testid="ga-script" data-strategy={strategy} src={src} />
	),
}));

const ga = vi.hoisted(() => ({
	enabled: true,
	googleAnalytics: {
		init: vi.fn(),
		trackPageView: vi.fn(),
		trackEvent: vi.fn(),
		setUserId: vi.fn(),
	},
}));

vi.mock("../utils/google-analytics", () => ({
	googleAnalytics: ga.googleAnalytics,
	isGoogleAnalyticsEnabled: () => ga.enabled,
	googleAnalyticsScriptSrc: () => (ga.enabled ? SCRIPT_SRC : null),
}));

beforeEach(() => {
	ga.enabled = true;
	navigation.pathname = "/";
	navigation.search = "";
	navigation.suspend = false;
	for (const fn of Object.values(ga.googleAnalytics)) {
		fn.mockReset();
	}
});

afterEach(() => {
	vi.resetModules();
});

describe("<GoogleAnalyticsProvider> — disabled", () => {
	beforeEach(() => {
		ga.enabled = false;
	});

	it("H5 / S1 — renders children without loading gtag.js or initialising the tag", async () => {
		const { GoogleAnalyticsProvider } = await import(
			"./google-analytics-provider"
		);
		render(
			<GoogleAnalyticsProvider>
				<div data-testid="child">hello</div>
			</GoogleAnalyticsProvider>,
		);
		expect(screen.getByTestId("child")).toHaveTextContent("hello");
		expect(screen.queryByTestId("ga-script")).toBeNull();
		expect(ga.googleAnalytics.init).not.toHaveBeenCalled();
	});
});

describe("<GoogleAnalyticsProvider> — enabled", () => {
	it("S2 — loads gtag.js and initialises the tag once", async () => {
		const { GoogleAnalyticsProvider } = await import(
			"./google-analytics-provider"
		);
		render(<GoogleAnalyticsProvider>{null}</GoogleAnalyticsProvider>);
		const script = screen.getByTestId("ga-script");
		expect(script).toHaveAttribute("src", SCRIPT_SRC);
		// Anything earlier competes with the app's own hydration for the main thread.
		expect(script).toHaveAttribute("data-strategy", "afterInteractive");
		expect(ga.googleAnalytics.init).toHaveBeenCalledTimes(1);
	});

	it("S3 — renders its children", async () => {
		const { GoogleAnalyticsProvider } = await import(
			"./google-analytics-provider"
		);
		render(
			<GoogleAnalyticsProvider>
				<div data-testid="child">hello</div>
			</GoogleAnalyticsProvider>,
		);
		expect(screen.getByTestId("child")).toHaveTextContent("hello");
	});

	it("AC9 — a suspending pageview tracker does not stop the app from rendering", async () => {
		navigation.suspend = true;
		const { GoogleAnalyticsProvider } = await import(
			"./google-analytics-provider"
		);
		render(
			<GoogleAnalyticsProvider>
				<div data-testid="child">hello</div>
			</GoogleAnalyticsProvider>,
		);
		expect(screen.getByTestId("child")).toHaveTextContent("hello");
	});
});

describe("<GoogleAnalyticsPageView>", () => {
	it("H1 — sends a pageview for the landing route, campaign params included", async () => {
		navigation.pathname = "/";
		navigation.search = "utm_source=newsletter";
		const { GoogleAnalyticsPageView } = await import(
			"./google-analytics-provider"
		);
		render(<GoogleAnalyticsPageView />);
		expect(ga.googleAnalytics.trackPageView).toHaveBeenCalledWith(
			"/",
			"utm_source=newsletter",
		);
	});

	it("H2 — sends a second pageview when the route changes", async () => {
		const { GoogleAnalyticsPageView } = await import(
			"./google-analytics-provider"
		);
		const { rerender } = render(<GoogleAnalyticsPageView />);
		navigation.pathname = "/sign-up";
		rerender(<GoogleAnalyticsPageView />);
		expect(ga.googleAnalytics.trackPageView).toHaveBeenCalledTimes(2);
		expect(ga.googleAnalytics.trackPageView).toHaveBeenLastCalledWith(
			"/sign-up",
			"",
		);
	});

	it("E5 — a re-render on the same route does not resend the pageview", async () => {
		const { GoogleAnalyticsPageView } = await import(
			"./google-analytics-provider"
		);
		const { rerender } = render(<GoogleAnalyticsPageView />);
		rerender(<GoogleAnalyticsPageView />);
		expect(ga.googleAnalytics.trackPageView).toHaveBeenCalledTimes(1);
	});
});

describe("<GoogleAnalyticsProvider> — user identity", () => {
	it("H3 — sets the GA4 user id when Clerk reports a signed-in user", async () => {
		mockAuthenticatedUser();
		const { GoogleAnalyticsProvider } = await import(
			"./google-analytics-provider"
		);
		render(<GoogleAnalyticsProvider>{null}</GoogleAnalyticsProvider>);
		expect(ga.googleAnalytics.setUserId).toHaveBeenCalledWith(mockUser.id);
	});

	it("H4 — clears the user id once on the signed-in to signed-out transition", async () => {
		mockAuthenticatedUser();
		const { GoogleAnalyticsProvider } = await import(
			"./google-analytics-provider"
		);
		const { rerender } = render(
			<GoogleAnalyticsProvider>{null}</GoogleAnalyticsProvider>,
		);
		mockUnauthenticatedUser();
		rerender(<GoogleAnalyticsProvider>{null}</GoogleAnalyticsProvider>);
		expect(ga.googleAnalytics.setUserId).toHaveBeenCalledTimes(2);
		expect(ga.googleAnalytics.setUserId).toHaveBeenLastCalledWith(null);
	});

	it("E11 — does not clear the user id on a first render that is already signed out", async () => {
		mockUnauthenticatedUser();
		const { GoogleAnalyticsProvider } = await import(
			"./google-analytics-provider"
		);
		render(<GoogleAnalyticsProvider>{null}</GoogleAnalyticsProvider>);
		expect(ga.googleAnalytics.setUserId).not.toHaveBeenCalled();
	});

	it("E10 — does not touch the user id while Clerk is still loading", async () => {
		mockLoadingUser();
		const { GoogleAnalyticsProvider } = await import(
			"./google-analytics-provider"
		);
		render(<GoogleAnalyticsProvider>{null}</GoogleAnalyticsProvider>);
		expect(ga.googleAnalytics.setUserId).not.toHaveBeenCalled();
	});

	it("E10 — a signed-in user going back to loading is not treated as a sign-out", async () => {
		mockAuthenticatedUser();
		const { GoogleAnalyticsProvider } = await import(
			"./google-analytics-provider"
		);
		const { rerender } = render(
			<GoogleAnalyticsProvider>{null}</GoogleAnalyticsProvider>,
		);
		mockLoadingUser();
		rerender(<GoogleAnalyticsProvider>{null}</GoogleAnalyticsProvider>);
		expect(ga.googleAnalytics.setUserId).toHaveBeenCalledTimes(1);
		expect(ga.googleAnalytics.setUserId).toHaveBeenCalledWith(mockUser.id);
	});
});
