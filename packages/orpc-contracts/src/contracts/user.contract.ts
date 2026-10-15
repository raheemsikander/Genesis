import { UserList, UserPreferences, UserSchema } from "@genesis/shared";
import { oc } from "@orpc/contract";

export const userContract = {
	me: oc.output(UserSchema),
	getPreferences: oc.output(UserPreferences),
	setPreferences: oc.input(UserPreferences).output(UserPreferences),
	list: oc.output(UserList),
};
