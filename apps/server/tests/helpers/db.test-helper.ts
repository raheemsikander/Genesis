import type { Table } from "drizzle-orm";
import { getTableName, sql } from "drizzle-orm";
import { db } from "../../src/db/db";

export async function truncateTables(...tables: Table[]) {
	for (const table of tables) {
		await db.execute(
			sql.raw(`TRUNCATE TABLE "${getTableName(table)}" CASCADE`),
		);
	}
}

export async function closeDatabase() {
	await db.$client.end();
}
