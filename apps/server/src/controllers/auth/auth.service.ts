import { ORPCError } from "@orpc/server";
import type { CompleteProfileInput } from "@repo/shared";
import { eq } from "drizzle-orm";
import { db, users } from "../../db";

export async function completeUserProfile(
	dbUserId: number,
	input: CompleteProfileInput,
) {
	const [updated] = await db
		.update(users)
		.set({
			name: input.name,
			role: input.role,
			updatedBy: dbUserId,
			updatedAt: new Date(),
		})
		.where(eq(users.id, dbUserId))
		.returning({ uuid: users.uuid });

	if (!updated) {
		throw new ORPCError("NOT_FOUND", { message: "User not found" });
	}

	return { success: true as const };
}
