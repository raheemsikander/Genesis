import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		CORS_ORIGIN: z
			.string()
			.transform((s) => s.split(",").map((v) => v.trim()))
			.pipe(z.array(z.url()).min(1)),
		PORT: z.coerce.number().default(3000),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		CLERK_SECRET_KEY: z.string().min(1),
		CLERK_PUBLISHABLE_KEY: z.string().min(1),
		RESEND_API_KEY: z.string().min(1).optional(),
		RESEND_FROM_EMAIL: z.email().optional(),
		TEST_DATABASE_URL: z.string().min(1).optional(),
		REDIS_URL: z.string().min(1).optional(),
		S3_ENDPOINT: z.url().optional(),
		S3_PUBLIC_ENDPOINT: z.url().optional(),
		S3_REGION: z.string().min(1).default("us-east-1"),
		S3_ACCESS_KEY_ID: z.string().min(1).optional(),
		S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
		S3_BUCKET: z.string().min(1).default("file-uploads"),
		LOG_LEVEL: z
			.enum(["trace", "debug", "info", "warn", "error", "fatal"])
			.default("info"),
		ROLLBAR_SERVER_TOKEN: z.string().min(1).optional(),
		DB_POOL_MAX: z.coerce.number().int().min(1).default(20),
	},
	runtimeEnv: process.env,
	skipValidation: process.env.CI === "true",
	emptyStringAsUndefined: true,
});
