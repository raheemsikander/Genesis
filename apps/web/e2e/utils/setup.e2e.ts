import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";
import { e2eEnv } from "./env.e2e";

setup.describe.configure({ mode: "serial" });

setup("global setup", async ({ request }) => {
	await clerkSetup();

	const authHeader = { Authorization: `Bearer ${e2eEnv.CLERK_SECRET_KEY}` };

	// Find the test user by email
	const usersRes = await request.get(
		`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(e2eEnv.E2E_CLERK_USER_USERNAME)}`,
		{ headers: authHeader },
	);
	const users = await usersRes.json();
	if (!users[0]) {
		throw new Error(
			`E2E test user not found: ${e2eEnv.E2E_CLERK_USER_USERNAME}`,
		);
	}

	// Disable MFA/device verification for the test user
	await request.delete(`https://api.clerk.com/v1/users/${users[0].id}/mfa`, {
		headers: authHeader,
	});
});
