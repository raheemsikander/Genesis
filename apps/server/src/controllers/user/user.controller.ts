import { protectedProcedure } from "../../orpc/procedures";
import {
	getUserByClerkId,
	getUserPreferences,
	listUsers,
	updateUserPreferences,
} from "./user.service";

export const userController = {
	me: protectedProcedure.user.me.handler(async ({ context }) => {
		return getUserByClerkId(context.userId);
	}),

	getPreferences: protectedProcedure.user.getPreferences.handler(
		async ({ context }) => {
			return getUserPreferences(context.userId);
		},
	),

	setPreferences: protectedProcedure.user.setPreferences.handler(
		async ({ context, input }) => {
			return updateUserPreferences(context.userId, input);
		},
	),

	list: protectedProcedure.user.list.handler(async () => {
		return listUsers();
	}),
};
