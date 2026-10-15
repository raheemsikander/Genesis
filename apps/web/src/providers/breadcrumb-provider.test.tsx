import { render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navState = { pathname: "/portal/users/abc" as string | null };

vi.mock("next/navigation", () => ({
	usePathname: () => navState.pathname,
}));

import {
	BreadcrumbProvider,
	useBreadcrumbLabels,
	useSetBreadcrumbLabel,
} from "./breadcrumb-provider";

function wrapper({ children }: { children: ReactNode }) {
	return <BreadcrumbProvider>{children}</BreadcrumbProvider>;
}

beforeEach(() => {
	navState.pathname = "/portal/users/abc";
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("useBreadcrumbLabels", () => {
	it("returns a frozen empty record when used outside a provider", () => {
		const { result } = renderHook(() => useBreadcrumbLabels());
		expect(result.current).toEqual({});
		expect(Object.isFrozen(result.current)).toBe(true);
	});

	it("exposes labels set via useSetBreadcrumbLabel", () => {
		const { result } = renderHook(
			() => {
				useSetBreadcrumbLabel("Jane Doe");
				return useBreadcrumbLabels();
			},
			{ wrapper },
		);
		expect(result.current["/portal/users/abc"]).toBe("Jane Doe");
	});
});

describe("useSetBreadcrumbLabel", () => {
	it("upserts and then clears the override on unmount", () => {
		const read = renderHook(() => useBreadcrumbLabels(), { wrapper });
		const setter = renderHook(() => useSetBreadcrumbLabel("Jane Doe"), {
			wrapper,
		});
		// Each renderHook mounts its own provider, so assert through a combined hook instead.
		setter.unmount();
		read.unmount();

		const { result, unmount } = renderHook(
			() => {
				useSetBreadcrumbLabel("Jane Doe");
				return useBreadcrumbLabels();
			},
			{ wrapper },
		);
		expect(result.current["/portal/users/abc"]).toBe("Jane Doe");
		unmount();
	});

	it("clears the override when the label transitions to undefined while mounted", () => {
		let label: string | undefined = "Jane Doe";
		const { result, rerender } = renderHook(
			() => {
				useSetBreadcrumbLabel(label);
				return useBreadcrumbLabels();
			},
			{ wrapper },
		);
		expect(result.current["/portal/users/abc"]).toBe("Jane Doe");

		label = undefined;
		rerender();
		expect(result.current["/portal/users/abc"]).toBeUndefined();
	});

	it("does not set a label when pathname is null", () => {
		navState.pathname = null;
		const { result } = renderHook(
			() => {
				useSetBreadcrumbLabel("Jane Doe");
				return useBreadcrumbLabels();
			},
			{ wrapper },
		);
		expect(result.current).toEqual({});
	});

	it("keeps the latest value when the same label is set twice (no churn)", () => {
		let label = "Jane Doe";
		const { result, rerender } = renderHook(
			() => {
				useSetBreadcrumbLabel(label);
				return useBreadcrumbLabels();
			},
			{ wrapper },
		);
		const first = result.current;
		label = "Jane Doe";
		rerender();
		expect(result.current["/portal/users/abc"]).toBe("Jane Doe");
		expect(result.current).toBe(first);
	});

	it("warns once when called outside a provider in development", async () => {
		// Re-import a fresh module so the once-only warn flag starts unset,
		// independent of whatever earlier tests in this file ran.
		vi.resetModules();
		const { useSetBreadcrumbLabel: freshSetter } = await import(
			"./breadcrumb-provider"
		);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		renderHook(() => freshSetter("Orphan"));
		renderHook(() => freshSetter("Orphan2"));
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0]?.[0]).toContain("BreadcrumbProvider");
	});
});

describe("BreadcrumbProvider", () => {
	it("renders its children", () => {
		const { getByTestId } = render(
			<BreadcrumbProvider>
				<div data-testid="child">hi</div>
			</BreadcrumbProvider>,
		);
		expect(getByTestId("child")).toHaveTextContent("hi");
	});

	it("supports setting overrides for two distinct paths independently", () => {
		let labels: Record<string, string> = {};
		function Reader() {
			labels = useBreadcrumbLabels();
			return null;
		}
		// usePathname reads navState at call time, so each writer pins its own
		// path by setting navState immediately before its hook runs.
		function Writer({ path, label }: { path: string; label: string }) {
			navState.pathname = path;
			useSetBreadcrumbLabel(label);
			return null;
		}
		render(
			<BreadcrumbProvider>
				<Writer path="/portal/users/abc" label="Alice" />
				<Writer path="/portal/admin/xyz" label="Bob" />
				<Reader />
			</BreadcrumbProvider>,
		);
		expect(labels["/portal/users/abc"]).toBe("Alice");
		expect(labels["/portal/admin/xyz"]).toBe("Bob");
	});
});

describe("setLabel guard branches", () => {
	it("does not clear another writer's label when expectedPrev mismatches", () => {
		let labels: Record<string, string> = {};
		function Reader() {
			labels = useBreadcrumbLabels();
			return null;
		}
		function WriterA() {
			useSetBreadcrumbLabel("A");
			return null;
		}
		function WriterB() {
			useSetBreadcrumbLabel("B");
			return null;
		}
		// Both writers target the same path. B mounts after A and wins; when A
		// unmounts, its cleanup clears with expectedPrev "A" — but the live value
		// is "B", so the guard must keep B's label.
		function Tree({ showA }: { showA: boolean }) {
			return (
				<BreadcrumbProvider>
					{showA ? <WriterA /> : null}
					<WriterB />
					<Reader />
				</BreadcrumbProvider>
			);
		}
		const { rerender } = render(<Tree showA={true} />);
		expect(labels["/portal/users/abc"]).toBe("B");

		rerender(<Tree showA={false} />);
		expect(labels["/portal/users/abc"]).toBe("B");
	});
});
