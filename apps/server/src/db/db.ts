import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../utils/env";
import { logger } from "../utils/logger";
import * as schema from "./schema";

function getDatabaseUrl(): string {
	if (env.NODE_ENV !== "test") {
		return env.DATABASE_URL;
	}
	if (!env.TEST_DATABASE_URL) {
		throw new Error("TEST_DATABASE_URL is required when NODE_ENV is test");
	}
	return env.TEST_DATABASE_URL;
}

export const pool = new Pool({
	connectionString: getDatabaseUrl(),
	max: env.DB_POOL_MAX,
	idleTimeoutMillis: 30_000,
	connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
	logger.error({ err }, "Unexpected PostgreSQL pool error");
});

export const db = drizzle(pool, { schema });
