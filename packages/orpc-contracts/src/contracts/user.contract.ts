import { oc } from "@orpc/contract";
import { UserList, UserPreferences, UserSchema } from "@repo/shared";

export const userContract = {
	me: oc.output(UserSchema),
	getPreferences: oc.output(UserPreferences),
	setPreferences: oc.input(UserPreferences).output(UserPreferences),
	list: oc.output(UserList),
};
