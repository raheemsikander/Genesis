import { protectedProcedure } from "../../orpc/procedures";
import { completeUserProfile } from "./auth.service";

export const authController = {
	completeProfile: protectedProcedure.auth.completeProfile.handler(
		async ({ context, input }) => {
			return completeUserProfile(context.dbUser.id, input);
		},
	),
};
