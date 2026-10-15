import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
	mockLoadingUser,
	mockUnauthenticatedUser,
	mockUser,
} from "../../../../tests/helpers/clerk.test-helper";
import ProfilePage from "./page";

describe("ProfilePage", () => {
	it("shows loading spinner while user is loading", () => {
		mockLoadingUser();
		const { container } = render(<ProfilePage />);
		expect(container.querySelector(".spinner")).toBeInTheDocument();
	});

	it("shows sign-in prompt when no user", () => {
		mockUnauthenticatedUser();
		render(<ProfilePage />);
		expect(
			screen.getByText("Sign in to view your profile."),
		).toBeInTheDocument();
	});

	it("displays user avatar with name as alt text", () => {
		render(<ProfilePage />);
		const avatar = screen.getByAltText("Test User");
		expect(avatar).toHaveAttribute("src", "https://example.com/avatar.png");
	});

	it("shows fallback icon when user has no avatar", () => {
		const original = mockUser.imageUrl;
		mockUser.imageUrl = "";
		render(<ProfilePage />);
		expect(screen.queryByRole("img")).not.toBeInTheDocument();
		mockUser.imageUrl = original;
	});

	it("displays email address", () => {
		render(<ProfilePage />);
		expect(screen.getAllByText("test@example.com")).toHaveLength(2);
	});

	it("displays formatted member since date", () => {
		render(<ProfilePage />);
		expect(screen.getByText("January 15, 2025")).toBeInTheDocument();
	});

	it("hides member since card when createdAt is missing", () => {
		const original = mockUser.createdAt;
		mockUser.createdAt = undefined as unknown as Date;
		render(<ProfilePage />);
		expect(screen.queryByText("Member Since")).not.toBeInTheDocument();
		mockUser.createdAt = original;
	});

	it("displays user ID", () => {
		render(<ProfilePage />);
		expect(screen.getByText("user_test_123")).toBeInTheDocument();
	});
});
