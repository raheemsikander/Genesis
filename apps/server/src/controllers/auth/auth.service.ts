import type { CompleteProfileInput } from "@genesis/shared";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { db, users } from "../../db";

export async function completeUserProfile(
	clerkId: string,
	input: CompleteProfileInput,
) {
	const [updated] = await db
		.update(users)
		.set({
			name: input.name,
			role: input.role,
			updatedBy: clerkId,
			updatedAt: new Date(),
		})
		.where(eq(users.clerkId, clerkId))
		.returning({ uuid: users.uuid });

	if (!updated) {
		throw new ORPCError("NOT_FOUND", { message: "User not found" });
	}

	return { success: true as const };
}
