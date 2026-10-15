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

	/**
	 * Redis and S3 share one variable each between dev and test, so a run
	 * started outside the sandbox wrapper picks up the dev stack from .env and
	 * writes into the developer's own Redis and bucket. The wrapper sets this
	 * marker once it has pointed both at the ephemeral stack. Checked here
	 * rather than in the per-file setup so nothing connects first.
	 *
	 * The marker is provenance, not content, so a CI job that provisions its
	 * own throwaway Redis and S3 has no way to satisfy it by doing the right
	 * thing. Such a workflow sets the marker itself.
	 */
	if (!process.env.GENESIS_TEST_INFRA && (env.REDIS_URL || env.S3_ENDPOINT)) {
		throw new Error(
			"Safety check: REDIS_URL/S3_ENDPOINT are set but were not provided by " +
				"the sandbox wrapper, so they most likely point at your dev stack. " +
				"Run integration tests with `pnpm test:server:integration`, which " +
				"starts the ephemeral test stack and points them at it. In CI, where " +
				"the services are throwaway containers already, set " +
				"GENESIS_TEST_INFRA=1 in the workflow to opt out of this check.",
		);
	}

	console.log("Syncing schema to test database...");
	execSync("pnpm drizzle-kit push --force", {
		cwd: import.meta.dirname,
		stdio: "inherit",
	});
}
