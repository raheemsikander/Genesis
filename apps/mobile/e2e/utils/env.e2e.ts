import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// E2E test-user credentials, consumed ONLY by the Maestro runner (run.ts).
// Plain (non-EXPO_PUBLIC_) vars — never imported by the app, so never inlined
// into the shipped bundle. Validated eagerly on import.
export const e2eEnv = createEnv({
	server: {
		E2E_CLERK_USER_USERNAME: z.email(),
		E2E_CLERK_USER_PASSWORD: z.string().min(1),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
