import { implement, ORPCError } from "@orpc/server";
import { appContract } from "@repo/orpc-contracts";
import { ensureUserExists } from "../controllers/user/user.service";
import { logger } from "../utils/logger";
import type { AuthContext } from "./auth-context";

const os = implement(appContract).$context<AuthContext>();

export const publicProcedure = os;

export async function loadActiveDbUser(clerkUserId: string) {
	let dbUser: Awaited<ReturnType<typeof ensureUserExists>>;
	try {
		dbUser = await ensureUserExists(clerkUserId);
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "Failed to load user account";
		throw new ORPCError("INTERNAL_SERVER_ERROR", { message });
	}

	if (dbUser.deletedAt !== null) {
		logger.warn(
			{ clerkId: clerkUserId, dbUserId: dbUser.id },
			"Authenticated request from soft-deleted user; blocking",
		);
		throw new ORPCError("UNAUTHORIZED", {
			message: "User account is deleted",
		});
	}

	return dbUser;
}

export const protectedProcedure = os.use(async ({ context, next }) => {
	if (!context.clerkId) {
		throw new ORPCError("UNAUTHORIZED", {
			message: "Authentication required",
		});
	}

	const dbUser = await loadActiveDbUser(context.clerkId);

	return next({
		context: {
			clerkId: context.clerkId,
			requestId: context.requestId,
			dbUser,
		},
	});
});
