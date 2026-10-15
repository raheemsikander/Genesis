import {
	InviteEmailInputSchema,
	InviteEmailSendResultSchema,
} from "@genesis/shared";
import { oc } from "@orpc/contract";

export const emailContract = {
	invite: oc.input(InviteEmailInputSchema).output(InviteEmailSendResultSchema),
};
