import { spawnSync } from "node:child_process";
import { e2eEnv } from "./utils/env.e2e.ts";

// Node loads apps/mobile/.env first via the --env-file-if-exists flag in the
// package.json script; importing e2eEnv above then validates the test-user
// credentials and throws a descriptive error if they are missing or malformed.
// Maestro's only mechanism for injecting vars into flows is `-e`, so the creds
// pass as CLI args — visible in `ps`/CI logs while the suite runs. Acceptable
// only because this is a throwaway Clerk dev-instance user, never a real one.
const result = spawnSync(
	"maestro",
	[
		"test",
		"apps/mobile/e2e",
		"-e",
		`E2E_CLERK_USER_USERNAME=${e2eEnv.E2E_CLERK_USER_USERNAME}`,
		"-e",
		`E2E_CLERK_USER_PASSWORD=${e2eEnv.E2E_CLERK_USER_PASSWORD}`,
	],
	{ stdio: "inherit" },
);

// spawnSync does not throw when the binary is missing — it returns an `error`
// and a null status. Surface it so "maestro not installed" is distinguishable
// from a failed flow rather than a bare exit code 1.
if (result.error) {
	const code = (result.error as NodeJS.ErrnoException).code;
	console.error(
		code === "ENOENT"
			? "Could not run 'maestro': not found on PATH. Install it (https://docs.maestro.dev) and ensure $HOME/.maestro/bin is on your PATH."
			: `Failed to launch 'maestro': ${result.error.message}`,
	);
	process.exit(1);
}

process.exit(result.status ?? 1);
