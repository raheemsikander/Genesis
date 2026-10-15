import { oc } from "@orpc/contract";
import { AuthSuccess, CompleteProfileInput } from "@repo/shared";

export const authContract = {
	completeProfile: oc.input(CompleteProfileInput).output(AuthSuccess),
};
