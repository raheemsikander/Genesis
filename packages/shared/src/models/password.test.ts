import { describe, expect, it } from "vitest";
import {
	getMissingSummary,
	getPasswordStrength,
	getStrengthLevel,
	isPasswordStringValid,
	isPasswordValid,
} from "./password";

const VALID_PASSWORD = "Abcdef1!";

describe("getPasswordStrength", () => {
	it("returns all true for a fully valid password", () => {
		const strength = getPasswordStrength(VALID_PASSWORD);
		expect(strength.minLength).toBe(true);
		expect(strength.hasUppercase).toBe(true);
		expect(strength.hasLowercase).toBe(true);
		expect(strength.hasDigit).toBe(true);
		expect(strength.hasSpecial).toBe(true);
	});

	it("sets minLength false when password is too short", () => {
		expect(getPasswordStrength("Abc1!").minLength).toBe(false);
	});

	it("sets hasUppercase false when no uppercase letter", () => {
		expect(getPasswordStrength("abcdef1!").hasUppercase).toBe(false);
	});

	it("sets hasLowercase false when no lowercase letter", () => {
		expect(getPasswordStrength("ABCDEF1!").hasLowercase).toBe(false);
	});

	it("sets hasDigit false when no digit", () => {
		expect(getPasswordStrength("Abcdefg!").hasDigit).toBe(false);
	});

	it("sets hasSpecial false when no special character", () => {
		expect(getPasswordStrength("Abcdef12").hasSpecial).toBe(false);
	});
});

describe("isPasswordValid", () => {
	it("returns true when all requirements are met", () => {
		expect(isPasswordValid(getPasswordStrength(VALID_PASSWORD))).toBe(true);
	});

	it("returns false when minLength requirement is missing", () => {
		expect(isPasswordValid(getPasswordStrength("Abc1!"))).toBe(false);
	});

	it("returns false when uppercase requirement is missing", () => {
		expect(isPasswordValid(getPasswordStrength("abcdef1!"))).toBe(false);
	});

	it("returns false when lowercase requirement is missing", () => {
		expect(isPasswordValid(getPasswordStrength("ABCDEF1!"))).toBe(false);
	});

	it("returns false when digit requirement is missing", () => {
		expect(isPasswordValid(getPasswordStrength("Abcdefg!"))).toBe(false);
	});

	it("returns false when special character requirement is missing", () => {
		expect(isPasswordValid(getPasswordStrength("Abcdef12"))).toBe(false);
	});
});

describe("isPasswordStringValid", () => {
	it("returns true for a fully valid password string", () => {
		expect(isPasswordStringValid(VALID_PASSWORD)).toBe(true);
	});

	it("returns false for an invalid password string", () => {
		expect(isPasswordStringValid("weak")).toBe(false);
	});
});

describe("getStrengthLevel", () => {
	it("returns score 0 and empty label when 0 requirements are met", () => {
		const strength = {
			minLength: false,
			hasUppercase: false,
			hasLowercase: false,
			hasDigit: false,
			hasSpecial: false,
		};
		expect(getStrengthLevel(strength)).toEqual({ score: 0, label: "" });
	});

	it("returns Weak label when 1 requirement is met", () => {
		const strength = {
			minLength: true,
			hasUppercase: false,
			hasLowercase: false,
			hasDigit: false,
			hasSpecial: false,
		};
		expect(getStrengthLevel(strength)).toEqual({ score: 1, label: "Weak" });
	});

	it("returns Weak label when 2 requirements are met", () => {
		const strength = {
			minLength: true,
			hasUppercase: true,
			hasLowercase: false,
			hasDigit: false,
			hasSpecial: false,
		};
		expect(getStrengthLevel(strength)).toEqual({ score: 2, label: "Weak" });
	});

	it("returns Medium label when 3 requirements are met", () => {
		const strength = {
			minLength: true,
			hasUppercase: true,
			hasLowercase: true,
			hasDigit: false,
			hasSpecial: false,
		};
		expect(getStrengthLevel(strength)).toEqual({ score: 3, label: "Medium" });
	});

	it("returns Medium label when 4 requirements are met", () => {
		const strength = {
			minLength: true,
			hasUppercase: true,
			hasLowercase: true,
			hasDigit: true,
			hasSpecial: false,
		};
		expect(getStrengthLevel(strength)).toEqual({ score: 4, label: "Medium" });
	});

	it("returns Strong label when all 5 requirements are met", () => {
		const strength = {
			minLength: true,
			hasUppercase: true,
			hasLowercase: true,
			hasDigit: true,
			hasSpecial: true,
		};
		expect(getStrengthLevel(strength)).toEqual({ score: 5, label: "Strong" });
	});
});

describe("getMissingSummary", () => {
	it("returns empty string when all requirements are met", () => {
		expect(getMissingSummary(getPasswordStrength(VALID_PASSWORD))).toBe("");
	});

	it("lists missing requirements in order: minLength first", () => {
		const strength = {
			minLength: false,
			hasUppercase: false,
			hasLowercase: false,
			hasDigit: false,
			hasSpecial: false,
		};
		const summary = getMissingSummary(strength);
		const parts = summary.split(", ");
		expect(parts[0]).toBe("8+ characters");
	});

	it("lists missing requirements in the correct order", () => {
		const strength = {
			minLength: false,
			hasUppercase: false,
			hasLowercase: false,
			hasDigit: false,
			hasSpecial: false,
		};
		expect(getMissingSummary(strength)).toBe(
			"8+ characters, uppercase letter, lowercase letter, number, special character",
		);
	});

	it("omits requirements that are already met", () => {
		const strength = {
			minLength: true,
			hasUppercase: false,
			hasLowercase: true,
			hasDigit: false,
			hasSpecial: true,
		};
		expect(getMissingSummary(strength)).toBe("uppercase letter, number");
	});

	it("returns only the special character entry when only that is missing", () => {
		const strength = {
			minLength: true,
			hasUppercase: true,
			hasLowercase: true,
			hasDigit: true,
			hasSpecial: false,
		};
		expect(getMissingSummary(strength)).toBe("special character");
	});
});
