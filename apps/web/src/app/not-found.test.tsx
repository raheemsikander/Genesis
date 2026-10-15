import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockRedirect } from "../../tests/helpers/navigation.test-helper";
import NotFound from "./not-found";

const auth = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
	auth: () => auth(),
}));

function signedIn() {
	auth.mockResolvedValue({ userId: "user_test_123" });
}

function signedOut() {
	auth.mockResolvedValue({ userId: null });
}

describe("NotFound", () => {
	beforeEach(() => {
		auth.mockReset();
	});

	it("renders the not-found page instead of redirecting a signed-in user", async () => {
		signedIn();

		render(await NotFound());

		expect(screen.getByText("Page not found")).toBeInTheDocument();
		expect(mockRedirect).not.toHaveBeenCalled();
	});

	it("renders the not-found page instead of redirecting a signed-out user", async () => {
		signedOut();

		render(await NotFound());

		expect(screen.getByText("Page not found")).toBeInTheDocument();
		expect(mockRedirect).not.toHaveBeenCalled();
	});

	it("points a signed-in user back to the portal", async () => {
		signedIn();

		render(await NotFound());

		expect(
			screen.getByRole("link", { name: "Back to dashboard" }),
		).toHaveAttribute("href", "/portal");
	});

	it("points a signed-out user to the marketing home page", async () => {
		signedOut();

		render(await NotFound());

		expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute(
			"href",
			"/",
		);
	});
});
