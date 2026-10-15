import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	client: {
		// development = local, staging = QA/testing (develop branch), production = live (main branch)
		NEXT_PUBLIC_NODE_ENV: z
			.enum(["development", "production", "staging"])
			.default("development"),
		NEXT_PUBLIC_SERVER_URL: z.url(),
		NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
		NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().min(1),
		NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().min(1),
		NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN: z.string().min(1).optional(),
		NEXT_PUBLIC_MIXPANEL_TOKEN: z.string().min(1).optional(),
	},
	runtimeEnv: {
		NEXT_PUBLIC_NODE_ENV: process.env.NEXT_PUBLIC_NODE_ENV,
		NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
		NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
			process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
		NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
		NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
		NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN:
			process.env.NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN,
		NEXT_PUBLIC_MIXPANEL_TOKEN: process.env.NEXT_PUBLIC_MIXPANEL_TOKEN,
	},
	skipValidation: process.env.CI === "true",
	emptyStringAsUndefined: true,
});
