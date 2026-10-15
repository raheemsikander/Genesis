import {
	Body,
	Container,
	Head,
	Hr,
	Html,
	Section,
	Text,
} from "@react-email/components";
import * as React from "react";

import { styles } from "./styles";

// Ensure React is in scope at runtime — tsx doesn't support the automatic JSX transform
void React;

interface EmailLayoutProps {
	children: React.ReactNode;
	footerText?: string;
}

export function EmailLayout({
	children,
	footerText = "This email was sent from Project Genesis. If you didn't expect this email, you can safely ignore it.",
}: EmailLayoutProps) {
	return (
		<Html>
			<Head />
			<Body style={styles.body}>
				<Container style={styles.container}>
					<Section style={styles.section}>
						{children}
						<Hr style={styles.hr} />
						<Text style={styles.footer}>{footerText}</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	);
}
