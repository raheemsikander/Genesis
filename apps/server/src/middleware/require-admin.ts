import { getAuth } from "@clerk/express";
import { Roles } from "@repo/shared";
import type { RequestHandler } from "express";
import { ensureUserExists } from "../controllers/user/user.service";
import { logger } from "../utils/logger";

export const requireAdmin: RequestHandler = async (req, res, next) => {
	const { userId } = getAuth(req);
	if (!userId) {
		res.status(401).json({ error: "Unauthorized" });
		return;
	}
	try {
		const dbUser = await ensureUserExists(userId);
		if (dbUser.deletedAt !== null) {
			res.status(401).json({ error: "User account is deleted" });
			return;
		}
		if (dbUser.role !== Roles.ADMIN) {
			res.status(403).json({ error: "Forbidden" });
			return;
		}
		next();
	} catch (err) {
		logger.error({ err, clerkId: userId }, "requireAdmin failed");
		const message =
			err instanceof Error ? err.message : "Internal Server Error";
		res.status(500).json({ error: message });
	}
};
