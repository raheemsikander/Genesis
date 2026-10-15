import type { ComponentProps } from "react";
import { useColorScheme } from "react-native";
import { TextInput } from "../../tw";

export function Input(
	props: ComponentProps<typeof TextInput> & { invalid?: boolean },
) {
	const { invalid, className = "", ...rest } = props;
	const scheme = useColorScheme();
	const placeholderColor = scheme === "dark" ? "#a8a8a8" : "#9ca3af";
	return (
		<TextInput
			placeholderTextColor={placeholderColor}
			className={`rounded-lg border bg-card px-4 py-3 text-base text-foreground ${invalid ? "border-destructive" : "border-border"} ${className}`}
			{...rest}
		/>
	);
}
