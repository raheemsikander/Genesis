import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// EXPO_PUBLIC_ vars are inlined into the bundle at build time; read config through `env`.
export const env = createEnv({
	clientPrefix: "EXPO_PUBLIC_",
	client: {
		// development = local, staging = QA (develop), production = live (main)
		EXPO_PUBLIC_NODE_ENV: z
			.enum(["development", "production", "staging"])
			.default("development"),
		EXPO_PUBLIC_SERVER_URL: z.url(),
		EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
	},
	runtimeEnv: {
		EXPO_PUBLIC_NODE_ENV: process.env.EXPO_PUBLIC_NODE_ENV,
		EXPO_PUBLIC_SERVER_URL: process.env.EXPO_PUBLIC_SERVER_URL,
		EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:
			process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
	},
	skipValidation: process.env.CI === "true",
	emptyStringAsUndefined: true,
});
