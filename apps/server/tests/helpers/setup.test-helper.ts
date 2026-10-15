import { afterAll } from "vitest";
import { env } from "../../src/utils/env";
import "./auth.test-helper";
import { closeDatabase } from "./db.test-helper";

if (!env.TEST_DATABASE_URL?.includes("test")) {
	throw new Error(
		`Safety check: TEST_DATABASE_URL must contain "test". Got: ${env.TEST_DATABASE_URL}`,
	);
}

afterAll(async () => {
	await closeDatabase();
});
