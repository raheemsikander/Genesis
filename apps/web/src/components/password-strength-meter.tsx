"use client";

import {
	getMissingSummary,
	getPasswordStrength,
	getStrengthLevel,
	isPasswordValid,
} from "../utils/password";
import { PasswordRequirement } from "./password-requirement";

interface PasswordStrengthMeterProps {
	password: string;
	focused: boolean;
}

export function PasswordStrengthMeter({
	password,
	focused,
}: PasswordStrengthMeterProps) {
	const strength = getPasswordStrength(password);
	const strengthLevel = getStrengthLevel(strength);
	const passwordValid = isPasswordValid(strength);
	const showCollapsedSummary = !focused && password && !passwordValid;

	return (
		<>
			{focused && (
				<div className="space-y-2 pt-1">
					<div className="flex items-center gap-2">
						<div className="flex h-1.5 flex-1 gap-1">
							{[1, 2, 3, 4, 5].map((i) => (
								<div
									key={i}
									className={`h-full flex-1 rounded-full transition-colors ${
										i <= strengthLevel.score ? strengthLevel.color : "bg-muted"
									}`}
								/>
							))}
						</div>
						{strengthLevel.label && (
							<span
								className={`font-medium text-xs ${
									strengthLevel.score <= 2
										? "text-destructive-foreground"
										: strengthLevel.score <= 4
											? "text-warning-foreground"
											: "text-success-foreground"
								}`}
							>
								{strengthLevel.label}
							</span>
						)}
					</div>
					<div className="grid grid-cols-2 gap-1">
						<PasswordRequirement
							met={strength.minLength}
							neutral={!password}
							label="8+ characters"
						/>
						<PasswordRequirement
							met={strength.hasUppercase}
							neutral={!password}
							label="Uppercase letter"
						/>
						<PasswordRequirement
							met={strength.hasLowercase}
							neutral={!password}
							label="Lowercase letter"
						/>
						<PasswordRequirement
							met={strength.hasDigit}
							neutral={!password}
							label="Number"
						/>
						<PasswordRequirement
							met={strength.hasSpecial}
							neutral={!password}
							label="Special character"
						/>
					</div>
				</div>
			)}

			{showCollapsedSummary && (
				<p className="invalid-input">
					Password needs: {getMissingSummary(strength)}
				</p>
			)}
		</>
	);
}
