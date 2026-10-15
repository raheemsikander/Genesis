import { defineConfig } from "drizzle-kit";
import { env } from "./src/utils/env";

export default defineConfig({
	schema: "./src/db/schema",
	out: "./src/db/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url:
			env.NODE_ENV === "test" && env.TEST_DATABASE_URL
				? env.TEST_DATABASE_URL
				: env.DATABASE_URL,
	},
});
