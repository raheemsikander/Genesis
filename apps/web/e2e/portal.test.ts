import { expect, test } from "@playwright/test";
import { signInViaUI } from "./utils/auth.e2e";

test.describe("Portal (unauthenticated)", () => {
	test("redirects to sign-in when not authenticated", async ({ page }) => {
		await page.goto("/portal");
		await expect(
			page.getByRole("heading", { name: "Sign in to Genesis" }),
		).toBeVisible();
	});

	test("all portal routes are protected", async ({ page }) => {
		const protectedRoutes = [
			"/portal/about",
			"/portal/profile",
			"/portal/colors",
		];

		for (const route of protectedRoutes) {
			await page.goto(route);
			await expect(
				page.getByRole("heading", { name: "Sign in to Genesis" }),
			).toBeVisible();
		}
	});
});

test.describe("Portal (authenticated)", () => {
	test.beforeEach(async ({ page }) => {
		await signInViaUI(page);
	});

	test("renders dashboard with welcome message", async ({ page }) => {
		await page.goto("/portal");
		await expect(
			page.getByRole("heading", { name: /welcome home/i }),
		).toBeVisible();
	});

	test("displays dashboard cards", async ({ page }) => {
		await page.goto("/portal");
		await expect(page.getByText("Getting Started")).toBeVisible();
		await expect(page.getByText("Navigation", { exact: true })).toBeVisible();
		await expect(
			page.getByText("Customization", { exact: true }),
		).toBeVisible();
	});

	test("sidebar shows navigation items", async ({ page }) => {
		await page.goto("/portal");
		await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
		await expect(page.getByRole("link", { name: "About" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Profile" })).toBeVisible();
	});

	test("navigates to about page", async ({ page }) => {
		await page.goto("/portal/about");
		await expect(page.getByRole("heading", { name: /about/i })).toBeVisible();
	});

	test("navigates to profile page", async ({ page }) => {
		await page.goto("/portal/profile");
		await expect(page.getByRole("heading", { name: /profile/i })).toBeVisible();
	});
});
