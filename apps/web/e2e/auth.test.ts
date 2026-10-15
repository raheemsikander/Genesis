import { expect, test } from "@playwright/test";

test.describe("Sign-in page", () => {
	test("renders sign-in form", async ({ page }) => {
		await page.goto("/sign-in");
		await expect(
			page.getByRole("heading", { name: "Sign in to Genesis" }),
		).toBeVisible();
		await expect(page.getByLabel("Email address")).toBeVisible();
		await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Continue", exact: true }),
		).toBeVisible();
	});

	test("has link to sign-up", async ({ page }) => {
		await page.goto("/sign-in");
		await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
	});
});

test.describe("Sign-up page", () => {
	test("renders sign-up form", async ({ page }) => {
		await page.goto("/sign-up");
		await expect(
			page.getByRole("heading", { name: "Create your account" }),
		).toBeVisible();
	});
});
