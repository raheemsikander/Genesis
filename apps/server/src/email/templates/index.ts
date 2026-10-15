import type { EmailTemplateMap } from "@repo/shared";

import { InviteEmailTemplate } from "./invite.template";

export const templateMap: EmailTemplateMap = {
	invite: InviteEmailTemplate,
};
