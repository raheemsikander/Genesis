import { expect, type Page, test } from "@playwright/test";
import { signInViaUI } from "./utils/auth.e2e";

// Computed-rect checks are more robust than toBeInViewport against future
// translate tweaks (e.g. -translate-x-[110%]) and animation timings.
async function asideRight(page: Page): Promise<number> {
	return page.evaluate(() => {
		const aside = document.querySelector("aside");
		return aside ? aside.getBoundingClientRect().right : Number.NaN;
	});
}

async function asideWidth(page: Page): Promise<number> {
	return page.evaluate(() => {
		const aside = document.querySelector("aside");
		return aside ? aside.getBoundingClientRect().width : Number.NaN;
	});
}

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

	test("unknown portal routes still require sign-in", async ({ page }) => {
		await page.goto("/portal/this-route-does-not-exist");
		await expect(
			page.getByRole("heading", { name: "Sign in to Genesis" }),
		).toBeVisible();
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

	test("shows the not-found page for an unknown portal route", async ({
		page,
	}) => {
		await page.goto("/portal/this-route-does-not-exist");
		await expect(
			page.getByRole("heading", { name: "Page not found" }),
		).toBeVisible();
		await expect(page).toHaveURL(/\/portal\/this-route-does-not-exist$/);
	});
});

test.describe("Portal sidebar — mobile (authenticated)", () => {
	test.use({ viewport: { width: 375, height: 667 } });

	test.beforeEach(async ({ page }) => {
		await signInViaUI(page);
		await page.goto("/portal");
	});

	test("starts collapsed and slides in as an overlay when toggled", async ({
		page,
	}) => {
		// Rect polling tolerates the 200ms transition without racing.
		await expect.poll(() => asideRight(page)).toBeLessThanOrEqual(0);

		await page.getByRole("button", { name: "Toggle sidebar" }).click();
		await expect.poll(() => asideRight(page)).toBeGreaterThan(0);
		await expect(page.getByRole("link", { name: "Home" })).toBeInViewport();

		const backdrop = page.getByRole("button", { name: "Close sidebar" });
		await expect(backdrop).toBeVisible();
		await backdrop.click();
		await expect.poll(() => asideRight(page)).toBeLessThanOrEqual(0);
	});

	test("closes itself after navigating to another portal route", async ({
		page,
	}) => {
		await page.getByRole("button", { name: "Toggle sidebar" }).click();
		await expect.poll(() => asideRight(page)).toBeGreaterThan(0);

		await page.getByRole("link", { name: "About" }).click();

		await expect.poll(() => asideRight(page)).toBeLessThanOrEqual(0);
		await expect(page.getByRole("heading", { name: /about/i })).toBeVisible();
	});

	test("closes itself after navigating via a submenu item", async ({
		page,
	}) => {
		await page.getByRole("button", { name: "Toggle sidebar" }).click();
		await expect.poll(() => asideRight(page)).toBeGreaterThan(0);

		await page.getByRole("button", { name: "Design System" }).click();
		await page.getByRole("link", { name: "Colors" }).click();

		await expect.poll(() => asideRight(page)).toBeLessThanOrEqual(0);
		await expect(page).toHaveURL(/\/portal\/colors$/);
	});

	test("closes itself when the current route is tapped again", async ({
		page,
	}) => {
		await page.getByRole("button", { name: "Toggle sidebar" }).click();
		await expect.poll(() => asideRight(page)).toBeGreaterThan(0);

		await page.getByRole("link", { name: "Home" }).click();

		await expect.poll(() => asideRight(page)).toBeLessThanOrEqual(0);
	});

	test("user-menu dropdown opens above the trigger on mobile", async ({
		page,
	}) => {
		await page.getByRole("button", { name: "Toggle sidebar" }).click();
		await expect.poll(() => asideRight(page)).toBeGreaterThan(0);

		// The user-menu trigger is the last button inside the sidebar footer
		// (contains the user name and a ChevronsUpDown icon).
		const aside = page.locator("aside");
		const userMenuTrigger = aside.locator("button").last();
		await userMenuTrigger.click();

		// base-ui renders the menu popup in a portal; data-side reflects the
		// resolved side prop, so mobile must resolve to "top".
		const popup = page.locator("[data-slot='dropdown-menu-content']");
		await expect(popup).toBeVisible();
		await expect(popup).toHaveAttribute("data-side", "top");
	});
});

test.describe("Portal sidebar — desktop → mobile resize (authenticated)", () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test.beforeEach(async ({ page }) => {
		await signInViaUI(page);
		await page.goto("/portal");
	});

	test("auto-collapses when the viewport crosses into mobile width", async ({
		page,
	}) => {
		await expect.poll(() => asideRight(page)).toBeGreaterThan(0);

		await page.setViewportSize({ width: 375, height: 667 });
		await expect.poll(() => asideRight(page)).toBeLessThanOrEqual(0);
	});

	test("restores collapsed desktop state after a mobile round-trip", async ({
		page,
	}) => {
		// Start expanded (default desktop state, ~240px = w-60).
		await expect.poll(() => asideWidth(page)).toBeGreaterThan(120);

		// Collapse the desktop sidebar via the header toggle.
		await page.getByRole("button", { name: "Toggle sidebar" }).click();
		await expect.poll(() => asideWidth(page)).toBeLessThan(80);

		// Cross into mobile — sidebar slides off-screen.
		await page.setViewportSize({ width: 375, height: 667 });
		await expect.poll(() => asideRight(page)).toBeLessThanOrEqual(0);

		// Open the overlay on mobile so we can verify the mobile-side flip
		// of isPermanentlyExpanded does not pollute the desktop snapshot.
		await page.getByRole("button", { name: "Toggle sidebar" }).click();
		await expect.poll(() => asideRight(page)).toBeGreaterThan(0);

		// Cross back to desktop — sidebar must restore to the collapsed icon
		// rail, not jump to expanded and not leak the overlay state.
		await page.setViewportSize({ width: 1280, height: 800 });
		await expect.poll(() => asideWidth(page)).toBeLessThan(80);
	});
});
