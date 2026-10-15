import { oc } from "@orpc/contract";
import {
	InviteEmailInputSchema,
	InviteEmailSendResultSchema,
} from "@repo/shared";

export const emailContract = {
	invite: oc.input(InviteEmailInputSchema).output(InviteEmailSendResultSchema),
};
