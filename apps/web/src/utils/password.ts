import {
	type PasswordStrength,
	getStrengthLevel as sharedGetStrengthLevel,
} from "@repo/shared";

export {
	getMissingSummary,
	getPasswordStrength,
	isPasswordStringValid,
	isPasswordValid,
} from "@repo/shared";
export type { PasswordStrength };

/** Web-only: extends the shared strength level with a Tailwind color class. */
export function getStrengthLevel(strength: PasswordStrength): {
	score: number;
	label: string;
	color: string;
} {
	const base = sharedGetStrengthLevel(strength);
	let color: string;
	if (base.score <= 0) {
		color = "bg-muted";
	} else if (base.score <= 2) {
		color = "bg-destructive-foreground";
	} else if (base.score <= 4) {
		color = "bg-warning-foreground";
	} else {
		color = "bg-success-foreground";
	}
	return { ...base, color };
}
