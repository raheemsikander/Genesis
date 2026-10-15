import { ORPCError } from "@orpc/server";
import { desc, eq } from "drizzle-orm";
import { users } from "../../db";
import { db } from "../../db/db";

export async function getUserByClerkId(clerkId: string) {
	const user = await db.query.users.findFirst({
		where: eq(users.clerkId, clerkId),
	});

	if (!user) {
		throw new ORPCError("NOT_FOUND", { message: "User not found" });
	}

	const { id: _, clerkId: __, ...safeUser } = user;
	return safeUser;
}

export async function getUserPreferences(clerkId: string) {
	const user = await db.query.users.findFirst({
		where: eq(users.clerkId, clerkId),
		columns: { preferences: true },
	});

	if (!user) {
		throw new ORPCError("NOT_FOUND", { message: "User not found" });
	}

	return user.preferences;
}

export async function updateUserPreferences(
	clerkId: string,
	input: Record<string, unknown>,
) {
	const existing = await db.query.users.findFirst({
		where: eq(users.clerkId, clerkId),
		columns: { preferences: true },
	});

	if (!existing) {
		throw new ORPCError("NOT_FOUND", { message: "User not found" });
	}

	const merged = {
		...existing.preferences,
		...input,
	};

	const [updated] = await db
		.update(users)
		.set({
			preferences: merged,
			updatedBy: clerkId,
			updatedAt: new Date(),
		})
		.where(eq(users.clerkId, clerkId))
		.returning();

	if (!updated) {
		throw new ORPCError("NOT_FOUND", { message: "User not found" });
	}

	return updated.preferences;
}

export async function listUsers() {
	const allUsers = await db.query.users.findMany({
		columns: {
			uuid: true,
			email: true,
			name: true,
			role: true,
			imageUrl: true,
			createdAt: true,
		},
		orderBy: [desc(users.createdAt)],
	});

	return { users: allUsers };
}
