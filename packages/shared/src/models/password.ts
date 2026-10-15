import { PASSWORD_RULES } from "./auth.types";

export const PASSWORD_MIN_LENGTH_LABEL = `${PASSWORD_RULES.minLength}+ characters`;

/** Check individual password requirements, useful for real-time UI feedback. */
export function getPasswordStrength(password: string) {
	return {
		minLength: password.length >= PASSWORD_RULES.minLength,
		hasUppercase: /[A-Z]/.test(password),
		hasLowercase: /[a-z]/.test(password),
		hasDigit: /[0-9]/.test(password),
		hasSpecial: /[^A-Za-z0-9]/.test(password),
	};
}

export type PasswordStrength = ReturnType<typeof getPasswordStrength>;

export function isPasswordValid(strength: PasswordStrength): boolean {
	return (
		strength.minLength &&
		strength.hasUppercase &&
		strength.hasLowercase &&
		strength.hasDigit &&
		strength.hasSpecial
	);
}

export function isPasswordStringValid(password: string): boolean {
	return isPasswordValid(getPasswordStrength(password));
}

export function getStrengthLevel(strength: PasswordStrength): {
	score: number;
	label: string;
} {
	const met = [
		strength.minLength,
		strength.hasUppercase,
		strength.hasLowercase,
		strength.hasDigit,
		strength.hasSpecial,
	].filter(Boolean).length;

	if (met <= 0) return { score: 0, label: "" };
	if (met <= 2) return { score: met, label: "Weak" };
	if (met <= 4) return { score: met, label: "Medium" };
	return { score: met, label: "Strong" };
}

export function getMissingSummary(strength: PasswordStrength): string {
	const missing: string[] = [];
	if (!strength.minLength) missing.push(PASSWORD_MIN_LENGTH_LABEL);
	if (!strength.hasUppercase) missing.push("uppercase letter");
	if (!strength.hasLowercase) missing.push("lowercase letter");
	if (!strength.hasDigit) missing.push("number");
	if (!strength.hasSpecial) missing.push("special character");
	return missing.join(", ");
}
