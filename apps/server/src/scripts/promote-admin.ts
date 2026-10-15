import { Roles } from "@repo/shared";
import { and, isNull, sql } from "drizzle-orm";
import { db, pool } from "../db/db";
import { users } from "../db/schema";

/**
 * Bootstraps the first admin. Role is never client-settable (see
 * user.service.ts), so the initial admin is seeded out-of-band by running:
 *
 *   pnpm --filter server promote-admin <email>
 *
 * The user must have signed in at least once so their row exists. Ongoing role
 * changes go through the admin-gated user.setRole procedure instead.
 */
async function main() {
	const email = process.argv[2]?.trim().toLowerCase();
	if (!email) {
		console.error("Usage: pnpm --filter server promote-admin <email>");
		process.exit(1);
	}

	const [updated] = await db
		.update(users)
		.set({ role: Roles.ADMIN, updatedAt: new Date() })
		.where(and(sql`lower(${users.email}) = ${email}`, isNull(users.deletedAt)))
		.returning({ uuid: users.uuid, email: users.email });

	if (!updated) {
		console.error(
			`No active user found with email "${email}". They must sign in once before being promoted.`,
		);
		process.exit(1);
	}

	console.log(`Promoted ${updated.email} to admin.`);
}

main()
	.catch((err) => {
		console.error("Failed to promote user:", err);
		process.exitCode = 1;
	})
	.finally(() => pool.end());
