import { clerkClient } from "@clerk/express";
import { ORPCError } from "@orpc/server";
import { Roles, type SetUserRoleInputSchema, UserRoleEnum } from "@repo/shared";
import { and, desc, eq, isNull } from "drizzle-orm";
import { users } from "../../db";
import { db } from "../../db/db";
import { logger } from "../../utils/logger";
import { withRetry } from "../../utils/retry";

export async function getUserById(dbUserId: number) {
	const user = await db.query.users.findFirst({
		where: eq(users.id, dbUserId),
		with: {
			createdByUser: { columns: { uuid: true } },
			updatedByUser: { columns: { uuid: true } },
		},
	});

	if (!user) {
		throw new ORPCError("NOT_FOUND", { message: "User not found" });
	}

	const { id: _, clerkId: __, createdByUser, updatedByUser, ...rest } = user;
	return {
		...rest,
		createdBy: createdByUser?.uuid ?? null,
		updatedBy: updatedByUser?.uuid ?? null,
	};
}

export async function getUserPreferences(dbUserId: number) {
	const user = await db.query.users.findFirst({
		where: eq(users.id, dbUserId),
		columns: { preferences: true },
	});

	if (!user) {
		throw new ORPCError("NOT_FOUND", { message: "User not found" });
	}

	return user.preferences;
}

export async function updateUserPreferences(
	dbUserId: number,
	input: Record<string, unknown>,
) {
	const existing = await db.query.users.findFirst({
		where: eq(users.id, dbUserId),
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
			updatedBy: dbUserId,
			updatedAt: new Date(),
		})
		.where(eq(users.id, dbUserId))
		.returning();

	if (!updated) {
		throw new ORPCError("NOT_FOUND", { message: "User not found" });
	}

	return updated.preferences;
}

// Throws plain Error (not ORPCError) so non-oRPC callers can translate it.
export async function ensureUserExists(clerkId: string) {
	const existing = await db.query.users.findFirst({
		where: eq(users.clerkId, clerkId),
		columns: { id: true, uuid: true, role: true, deletedAt: true },
	});

	if (existing) {
		return existing;
	}

	// Only read from Clerk on first auth; the DB is source of truth afterward.
	let clerkUser: Awaited<ReturnType<typeof clerkClient.users.getUser>>;
	try {
		clerkUser = await withRetry(() => clerkClient.users.getUser(clerkId), {
			onRetry: (err, attempt, delayMs) => {
				logger.warn(
					{ err, clerkId, attempt, delayMs },
					"Clerk getUser failed, retrying",
				);
			},
		});
	} catch (clerkError) {
		logger.error(
			{ err: clerkError, clerkId },
			"Clerk getUser failed during first-auth user provisioning",
		);
		throw new Error("Identity provider unavailable. Please try again.", {
			cause: clerkError,
		});
	}

	/**
	 * Role is seeded only from privateMetadata, which is writable exclusively
	 * from the backend (Clerk secret key). unsafeMetadata is client-writable, so
	 * trusting it here would let anyone self-assign admin at sign-up. New users
	 * default to MEMBER; promotion to admin is a backend-only action.
	 */
	const metadataRole = (
		clerkUser.privateMetadata as { role?: string } | undefined
	)?.role;
	const role = UserRoleEnum.safeParse(metadataRole).data ?? Roles.MEMBER;

	const [inserted] = await db
		.insert(users)
		.values({
			clerkId,
			email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
			name:
				[clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
				"",
			imageUrl: clerkUser.imageUrl,
			role,
		})
		.onConflictDoNothing({ target: users.clerkId })
		.returning({
			id: users.id,
			uuid: users.uuid,
			role: users.role,
			deletedAt: users.deletedAt,
		});

	if (inserted) {
		logger.info({ clerkId, role }, "Created new user from Clerk data");
		return inserted;
	}

	const retry = await db.query.users.findFirst({
		where: eq(users.clerkId, clerkId),
		columns: { id: true, uuid: true, role: true, deletedAt: true },
	});
	if (!retry) {
		logger.error(
			{ clerkId },
			"User insert was a no-op but row could not be loaded",
		);
		throw new Error("Failed to create user account");
	}
	return retry;
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

export async function setUserRole(
	actingUserId: number,
	input: SetUserRoleInputSchema,
) {
	const [updated] = await db
		.update(users)
		.set({
			role: input.role,
			updatedBy: actingUserId,
			updatedAt: new Date(),
		})
		.where(and(eq(users.uuid, input.uuid), isNull(users.deletedAt)))
		.returning({ uuid: users.uuid });

	if (!updated) {
		throw new ORPCError("NOT_FOUND", { message: "User not found" });
	}

	return { success: true as const };
}
