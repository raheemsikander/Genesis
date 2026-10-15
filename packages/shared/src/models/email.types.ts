import { z } from "zod";

export const InviteEmailInputSchema = z.object({
	to: z.email(),
	message: z.string().max(500).optional(),
});

export type InviteEmailInputSchema = z.infer<typeof InviteEmailInputSchema>;

export const InviteEmailSendResultSchema = z.object({
	id: z.string(),
});

export type InviteEmailSendResultSchema = z.infer<
	typeof InviteEmailSendResultSchema
>;
