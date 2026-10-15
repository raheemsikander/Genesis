import { z } from "zod";

const inviteSchema = z.object({
	inviterName: z.string(),
	inviterEmail: z.email(),
	appUrl: z.url(),
	message: z.string().optional(),
});

export const EmailTemplates = {
	invite: {
		schema: inviteSchema,
		subject: (data: z.infer<typeof inviteSchema>) =>
			`${data.inviterName} invited you to Project Genesis`,
	},
};

export type EmailTemplateName = keyof typeof EmailTemplates;

export type EmailTemplateData<T extends EmailTemplateName> = z.infer<
	(typeof EmailTemplates)[T]["schema"]
>;

export type EmailTemplateMap = {
	[K in EmailTemplateName]: (props: EmailTemplateData<K>) => unknown;
};
