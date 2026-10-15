import { AuthSuccess, CompleteProfileInput } from "@genesis/shared";
import { oc } from "@orpc/contract";

export const authContract = {
	completeProfile: oc.input(CompleteProfileInput).output(AuthSuccess),
};
