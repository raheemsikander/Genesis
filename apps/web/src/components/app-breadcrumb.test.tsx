import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navState = { pathname: "/portal/about" as string | null };

vi.mock("next/navigation", () => ({
	usePathname: () => navState.pathname,
}));

import { AppBreadcrumb } from "./app-breadcrumb";

beforeEach(() => {
	navState.pathname = "/portal/about";
});

describe("<AppBreadcrumb>", () => {
	it("renders nothing meaningful for the root path (no segments)", () => {
		navState.pathname = "/";
		const { container } = render(<AppBreadcrumb />);
		expect(container.querySelectorAll("a")).toHaveLength(0);
	});

	it("renders a crumb per segment, last as the current page", () => {
		navState.pathname = "/portal/about";
		render(<AppBreadcrumb />);
		// "Home" comes from the static label for /portal, "About" for /portal/about.
		expect(screen.getByText("Home")).toBeInTheDocument();
		expect(screen.getByText("About")).toBeInTheDocument();
		// The last crumb (current page) is not a link.
		const aboutLink = screen.queryByRole("link", { name: "About" });
		expect(aboutLink).toBeNull();
		expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
			"href",
			"/portal",
		);
	});

	it("title-cases unmapped segments", () => {
		navState.pathname = "/portal/billing-history";
		render(<AppBreadcrumb />);
		expect(screen.getByText("Billing History")).toBeInTheDocument();
	});

	it("renders a skeleton crumb for an unmapped UUID segment", () => {
		navState.pathname = "/portal/users/123e4567-e89b-12d3-a456-426614174000";
		const { container } = render(<AppBreadcrumb />);
		expect(container.querySelector('[role="status"]')).toBeTruthy();
	});

	it("collapses the middle into an ellipsis when there are three or more crumbs", () => {
		navState.pathname = "/portal/users/janedoe";
		const { container } = render(<AppBreadcrumb />);
		// Ellipsis item carries the sm:hidden middle-collapse class.
		expect(container.querySelector(".sm\\:hidden")).toBeTruthy();
		expect(screen.getByText("Janedoe")).toBeInTheDocument();
	});
});
