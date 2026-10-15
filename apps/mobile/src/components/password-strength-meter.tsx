import {
	getMissingSummary,
	getPasswordStrength,
	getStrengthLevel,
	isPasswordValid,
	PASSWORD_MIN_LENGTH_LABEL,
} from "@repo/shared";
import { View } from "react-native";
import { Text } from "../components/ui";
import { PasswordRequirement } from "./password-requirement";

export function PasswordStrengthMeter({
	password,
	focused,
}: {
	password: string;
	focused: boolean;
}) {
	const strength = getPasswordStrength(password);
	const level = getStrengthLevel(strength);
	const valid = isPasswordValid(strength);
	const showCollapsed = !focused && password.length > 0 && !valid;
	const barColor =
		level.score <= 2
			? "bg-destructive"
			: level.score <= 4
				? "bg-muted-foreground"
				: "bg-primary";

	if (focused) {
		return (
			<View className="gap-2 pt-1">
				<View className="flex-row items-center gap-2">
					<View className="h-1.5 flex-1 flex-row gap-1">
						{[1, 2, 3, 4, 5].map((i) => (
							<View
								key={i}
								className={`h-full flex-1 rounded-full ${i <= level.score ? barColor : "bg-muted"}`}
							/>
						))}
					</View>
					{level.label ? (
						<Text className="font-medium text-foreground text-xs">
							{level.label}
						</Text>
					) : null}
				</View>
				<View className="flex-row flex-wrap gap-x-4 gap-y-1">
					<PasswordRequirement
						met={strength.minLength}
						neutral={!password}
						label={PASSWORD_MIN_LENGTH_LABEL}
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
				</View>
			</View>
		);
	}
	if (showCollapsed) {
		return (
			<Text className="text-destructive text-sm">
				Password needs: {getMissingSummary(strength)}
			</Text>
		);
	}
	return null;
}
