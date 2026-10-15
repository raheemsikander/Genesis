import { protectedProcedure } from "../../orpc/procedures";
import { sendInviteEmail } from "./email.service";

export const emailController = {
	invite: protectedProcedure.email.invite.handler(
		async ({ context, input }) => {
			return sendInviteEmail(context.dbUser.id, input);
		},
	),
};
