import { Button, Heading, Hr, Text } from "@react-email/components";
import type { EmailTemplateData } from "@repo/shared";
import * as React from "react";

import { EmailLayout } from "../components/email-layout";
import { styles } from "../components/styles";

// Ensure React is in scope at runtime — tsx doesn't support the automatic JSX transform
void React;

export function InviteEmailTemplate({
	inviterName,
	inviterEmail,
	appUrl,
	message,
}: EmailTemplateData<"invite">) {
	return (
		<EmailLayout footerText="If you weren't expecting this invitation, you can safely ignore this email.">
			<Heading style={styles.heading}>You've been invited!</Heading>

			<Text style={styles.text}>
				<strong>{inviterName}</strong>
				{inviterEmail ? ` (${inviterEmail})` : ""} has invited you to join
				Project Genesis.
			</Text>

			{message && (
				<>
					<Hr style={styles.hr} />
					<Text style={styles.mutedText}>
						<em>"{message}"</em>
					</Text>
				</>
			)}

			<Hr style={styles.hr} />

			<Button style={styles.button} href={appUrl}>
				Accept Invitation
			</Button>
		</EmailLayout>
	);
}
