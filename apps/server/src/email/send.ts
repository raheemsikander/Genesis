import { render } from "@react-email/render";
import {
	type EmailTemplateData,
	type EmailTemplateName,
	EmailTemplates,
} from "@repo/shared";
import React from "react";
import { env } from "../utils/env";
import { getResendClient } from "./client";
import { templateMap } from "./templates";

export interface SendEmailParams<T extends EmailTemplateName> {
	to: string | string[];
	template: T;
	data: EmailTemplateData<T>;
}

export async function sendEmail<T extends EmailTemplateName>({
	to,
	template,
	data,
}: SendEmailParams<T>) {
	if (!env.RESEND_FROM_EMAIL) {
		throw new Error(
			"Email sending is not configured. Set RESEND_FROM_EMAIL to enable.",
		);
	}

	const config = EmailTemplates[template];
	const Component = templateMap[template];

	const element = React.createElement(
		Component as React.ComponentType,
		data as Record<string, unknown>,
	);
	const html = await render(element);
	const subject = config.subject(data);

	const { data: result, error } = await getResendClient().emails.send({
		from: env.RESEND_FROM_EMAIL,
		to,
		subject,
		html,
	});

	if (error) {
		throw new Error(`Failed to send email: ${error.message}`);
	}

	return { id: result.id };
}
