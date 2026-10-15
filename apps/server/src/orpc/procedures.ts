import { clerkClient } from "@clerk/express";
import { appContract } from "@genesis/orpc-contracts";
import { implement, ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { db, users } from "../db";
import { logger } from "../utils/logger";
import type { AuthContext } from "./auth-context";

const os = implement(appContract).$context<AuthContext>();

export const publicProcedure = os;

export const protectedProcedure = os.use(async ({ context, next }) => {
	if (!context.userId) {
		throw new ORPCError("UNAUTHORIZED", {
			message: "Authentication required",
		});
	}

	const existing = await db.query.users.findFirst({
		where: eq(users.clerkId, context.userId),
		columns: { id: true },
	});

	if (!existing) {
		// New user — create DB record from Clerk data.
		// This is the only time we read from Clerk; after creation,
		// our DB is the source of truth for name, email, etc.
		const clerkUser = await clerkClient.users.getUser(context.userId);
		const metadata = clerkUser.unsafeMetadata as { role?: string } | undefined;
		const role =
			metadata?.role === "admin" || metadata?.role === "member"
				? metadata.role
				: "member";

		try {
			await db.insert(users).values({
				clerkId: context.userId,
				email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
				name:
					[clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
					"",
				imageUrl: clerkUser.imageUrl,
				role,
			});
			logger.info(
				{ clerkId: context.userId, role },
				"Created new user from Clerk data",
			);
		} catch (insertError) {
			// If insert fails (e.g. race condition with concurrent requests),
			// check if the user was created by the other request
			const retryCheck = await db.query.users.findFirst({
				where: eq(users.clerkId, context.userId),
				columns: { id: true },
			});
			if (!retryCheck) {
				logger.error(insertError, "Failed to auto-create user in DB");
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create user account",
				});
			}
		}
	}

	return next({
		context: {
			userId: context.userId,
			requestId: context.requestId,
		},
	});
});

export const adminProcedure = protectedProcedure.use(
	async ({ context, next }) => {
		const user = await db.query.users.findFirst({
			where: eq(users.clerkId, context.userId),
			columns: { role: true },
		});

		if (!user || user.role !== "admin") {
			throw new ORPCError("FORBIDDEN", {
				message: "Admin access required",
			});
		}

		return next({ context });
	},
);
