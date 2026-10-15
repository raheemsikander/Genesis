import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { users } from "../../db";
import { db } from "../../db/db";
import { sendEmail } from "../../email";
import { env } from "../../utils/env";

export async function sendInviteEmail(
	dbUserId: number,
	input: { to: string; message?: string },
) {
	const sender = await db.query.users.findFirst({
		where: eq(users.id, dbUserId),
		columns: { name: true, email: true },
	});

	if (!sender) {
		throw new ORPCError("NOT_FOUND", { message: "User not found" });
	}

	/**
	 * First CORS origin is the primary app URL. The env schema enforces a
	 * non-empty array (.min(1)), so this is always set in practice; fail loudly
	 * rather than shipping invite emails with a broken link if it ever isn't.
	 * ORPCError (not a bare Error) so the onError interceptor reports it to
	 * Rollbar — it only forwards ORPCError instances with status >= 500.
	 */
	const [appUrl] = env.CORS_ORIGIN;
	if (!appUrl) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "CORS_ORIGIN must contain at least one origin",
		});
	}

	return sendEmail({
		to: input.to,
		template: "invite",
		data: {
			inviterName: sender.name || "A team member",
			inviterEmail: sender.email,
			appUrl,
			message: input.message,
		},
	});
}
