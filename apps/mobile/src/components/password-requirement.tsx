import { View } from "react-native";
import { Text } from "../components/ui";

export function PasswordRequirement({
	met,
	neutral,
	label,
}: {
	met: boolean;
	neutral: boolean;
	label: string;
}) {
	const color = neutral
		? "text-muted-foreground"
		: met
			? "text-primary"
			: "text-destructive";
	return (
		<View className="flex-row items-center gap-1">
			<Text className={`text-xs ${color}`}>{met ? "✓" : "○"}</Text>
			<Text className={`text-xs ${color}`}>{label}</Text>
		</View>
	);
}
