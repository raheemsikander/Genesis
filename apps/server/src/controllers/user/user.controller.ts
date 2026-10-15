import { protectedProcedure } from "../../orpc/procedures";
import {
	getUserById,
	getUserPreferences,
	listUsers,
	updateUserPreferences,
} from "./user.service";

export const userController = {
	me: protectedProcedure.user.me.handler(async ({ context }) => {
		return getUserById(context.dbUser.id);
	}),

	getPreferences: protectedProcedure.user.getPreferences.handler(
		async ({ context }) => {
			return getUserPreferences(context.dbUser.id);
		},
	),

	setPreferences: protectedProcedure.user.setPreferences.handler(
		async ({ context, input }) => {
			return updateUserPreferences(context.dbUser.id, input);
		},
	),

	list: protectedProcedure.user.list.handler(async () => {
		return listUsers();
	}),
};
