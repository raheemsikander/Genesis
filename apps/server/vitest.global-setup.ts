import { execSync } from "node:child_process";
import { env } from "./src/utils/env";

export default function globalSetup() {
	const testDbUrl = env.TEST_DATABASE_URL;
	if (!testDbUrl) {
		throw new Error("TEST_DATABASE_URL is required to run tests");
	}

	if (!testDbUrl.includes("test")) {
		throw new Error(
			`Safety check: TEST_DATABASE_URL must contain "test". Got: ${testDbUrl}`,
		);
	}

	console.log("Syncing schema to test database...");
	execSync("pnpm drizzle-kit push --force", {
		cwd: import.meta.dirname,
		stdio: "inherit",
	});
}
