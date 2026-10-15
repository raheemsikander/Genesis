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

	return sendEmail({
		to: input.to,
		template: "invite",
		data: {
			inviterName: sender.name || "A team member",
			inviterEmail: sender.email,
			appUrl: env.CORS_ORIGIN,
			message: input.message,
		},
	});
}
