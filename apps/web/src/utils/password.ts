const PASSWORD_MIN_LENGTH = 8;

/** Check individual password requirements — useful for real-time UI feedback. */
export function getPasswordStrength(password: string) {
	return {
		minLength: password.length >= PASSWORD_MIN_LENGTH,
		hasUppercase: /[A-Z]/.test(password),
		hasLowercase: /[a-z]/.test(password),
		hasDigit: /[0-9]/.test(password),
		hasSpecial: /[^A-Za-z0-9]/.test(password),
	};
}

export function isPasswordValid(password: string): boolean {
	const s = getPasswordStrength(password);
	return (
		s.minLength &&
		s.hasUppercase &&
		s.hasLowercase &&
		s.hasDigit &&
		s.hasSpecial
	);
}

export function getStrengthLevel(password: string) {
	if (!password) return { score: 0, label: "", color: "bg-muted" };

	const s = getPasswordStrength(password);
	const met = [
		s.minLength,
		s.hasUppercase,
		s.hasLowercase,
		s.hasDigit,
		s.hasSpecial,
	].filter(Boolean).length;

	if (met <= 2)
		return { score: met, label: "Weak", color: "bg-destructive-foreground" };
	if (met <= 4)
		return { score: met, label: "Medium", color: "bg-warning-foreground" };
	return { score: met, label: "Strong", color: "bg-success-foreground" };
}

export function getMissingSummary(password: string): string {
	const s = getPasswordStrength(password);
	const missing: string[] = [];
	if (!s.minLength) missing.push("8+ characters");
	if (!s.hasUppercase) missing.push("uppercase letter");
	if (!s.hasLowercase) missing.push("lowercase letter");
	if (!s.hasDigit) missing.push("number");
	if (!s.hasSpecial) missing.push("special character");
	return missing.join(", ");
}
