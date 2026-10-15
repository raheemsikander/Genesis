import type { CSSProperties } from "react";

/**
 * Design system colors (light mode).
 * Sourced from packages/ui/src/styles/globals.css
 */
export const colors = {
	foreground: "#173a40",
	mutedForeground: "#416166",
	ring: "#4fb8b2",
	primary: "#328f97",
	successForeground: "#4a7a57",
	border: "#dfe3e4",
	background: "#f9fafb",
	white: "#ffffff",
} as const;

/** Reusable email styles using the design system palette. */
export const styles = {
	body: {
		backgroundColor: colors.background,
		fontFamily:
			'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
	},
	container: {
		backgroundColor: colors.white,
		margin: "0 auto",
		padding: "20px 0 48px",
		marginBottom: "64px",
	},
	section: {
		padding: "0 48px",
	},
	heading: {
		fontSize: "32px",
		lineHeight: "1.3",
		fontWeight: "700",
		color: colors.foreground,
	},
	text: {
		fontSize: "16px",
		lineHeight: "26px",
		color: colors.foreground,
	},
	mutedText: {
		fontSize: "14px",
		lineHeight: "22px",
		color: colors.mutedForeground,
	},
	button: {
		backgroundColor: colors.primary,
		borderRadius: "4px",
		color: colors.white,
		fontSize: "16px",
		fontWeight: "bold",
		textDecoration: "none",
		textAlign: "center" as const,
		display: "block",
		width: "100%",
		padding: "12px",
	},
	hr: {
		borderColor: colors.border,
		margin: "20px 0",
	},
	footer: {
		color: colors.mutedForeground,
		fontSize: "12px",
		lineHeight: "16px",
	},
} satisfies Record<string, CSSProperties>;
