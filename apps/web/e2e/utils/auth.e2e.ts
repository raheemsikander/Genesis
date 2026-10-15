import { clerk } from "@clerk/testing/playwright";
import type { Page } from "@playwright/test";
import { e2eEnv } from "./env.e2e";

export async function signInViaUI(page: Page) {
	await page.goto("/");
	await clerk.signIn({
		page,
		signInParams: {
			strategy: "password",
			identifier: e2eEnv.E2E_CLERK_USER_USERNAME,
			password: e2eEnv.E2E_CLERK_USER_PASSWORD,
		},
	});
}
