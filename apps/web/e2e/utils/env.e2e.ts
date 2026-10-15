import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const e2eEnv = createEnv({
	server: {
		E2E_CLERK_USER_USERNAME: z.string().email(),
		E2E_CLERK_USER_PASSWORD: z.string().min(1),
		CLERK_SECRET_KEY: z.string().startsWith("sk_"),
	},
	runtimeEnv: {
		E2E_CLERK_USER_USERNAME: process.env.E2E_CLERK_USER_USERNAME,
		E2E_CLERK_USER_PASSWORD: process.env.E2E_CLERK_USER_PASSWORD,
		CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
	},
	emptyStringAsUndefined: true,
});
