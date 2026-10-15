import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navState = { pathname: "/portal" };

vi.mock("next/navigation", () => ({
	usePathname: () => navState.pathname,
}));

import {
	SidebarControlProvider,
	useSidebarControl,
} from "./sidebar-control-provider";

const viewport = { isMobile: false };
const mediaListeners = new Set<() => void>();
const realMatchMedia = window.matchMedia;

function installMatchMedia() {
	window.matchMedia = ((query: string) => ({
		get matches() {
			return viewport.isMobile;
		},
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: (_: string, listener: () => void) =>
			mediaListeners.add(listener),
		removeEventListener: (_: string, listener: () => void) =>
			mediaListeners.delete(listener),
		dispatchEvent: () => false,
	})) as unknown as typeof window.matchMedia;
}

function resizeTo(isMobile: boolean) {
	act(() => {
		viewport.isMobile = isMobile;
		for (const listener of mediaListeners) listener();
	});
}

function wrapper({ children }: { children: ReactNode }) {
	return <SidebarControlProvider>{children}</SidebarControlProvider>;
}

function renderSidebarControl() {
	return renderHook(() => useSidebarControl(), { wrapper });
}

beforeEach(() => {
	navState.pathname = "/portal";
	viewport.isMobile = false;
	mediaListeners.clear();
	installMatchMedia();
});

afterEach(() => {
	window.matchMedia = realMatchMedia;
});

describe("SidebarControlProvider on mobile", () => {
	it("closes the drawer when the route changes", () => {
		viewport.isMobile = true;
		const { result, rerender } = renderSidebarControl();
		expect(result.current.isPermanentlyExpanded).toBe(false);

		act(() => result.current.handleManualToggle());
		expect(result.current.isPermanentlyExpanded).toBe(true);

		navState.pathname = "/portal/about";
		rerender();

		expect(result.current.isPermanentlyExpanded).toBe(false);
	});

	it("closes the drawer when a link for the current route is tapped", () => {
		viewport.isMobile = true;
		const { result } = renderSidebarControl();

		act(() => result.current.handleManualToggle());
		expect(result.current.isPermanentlyExpanded).toBe(true);

		act(() => result.current.closeOnNavigate());

		expect(result.current.isPermanentlyExpanded).toBe(false);
	});

	it("restores the desktop state, not the mobile drawer state, on the way back up", () => {
		const { result } = renderSidebarControl();
		expect(result.current.isPermanentlyExpanded).toBe(true);

		resizeTo(true);
		act(() => result.current.handleManualToggle());
		expect(result.current.isPermanentlyExpanded).toBe(true);

		act(() => result.current.closeOnNavigate());
		resizeTo(false);

		expect(result.current.isPermanentlyExpanded).toBe(true);
	});
});

describe("SidebarControlProvider on desktop", () => {
	it("keeps the sidebar expanded across route changes", () => {
		const { result, rerender } = renderSidebarControl();
		expect(result.current.isPermanentlyExpanded).toBe(true);

		navState.pathname = "/portal/about";
		rerender();

		expect(result.current.isPermanentlyExpanded).toBe(true);
	});

	it("ignores closeOnNavigate so navigation never collapses the sidebar", () => {
		const { result } = renderSidebarControl();

		act(() => result.current.closeOnNavigate());

		expect(result.current.isPermanentlyExpanded).toBe(true);
	});

	it("restores the desktop state after a round trip through mobile width", () => {
		const { result } = renderSidebarControl();
		expect(result.current.isPermanentlyExpanded).toBe(true);

		resizeTo(true);
		expect(result.current.isPermanentlyExpanded).toBe(false);

		resizeTo(false);
		expect(result.current.isPermanentlyExpanded).toBe(true);
	});
});

describe("useSidebarControl", () => {
	it("throws when used outside a provider", () => {
		expect(() => renderHook(() => useSidebarControl())).toThrow(
			"useSidebarControl must be used within a SidebarControlProvider",
		);
	});
});
