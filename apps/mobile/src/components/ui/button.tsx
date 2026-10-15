import type { ReactNode } from "react";
import { ActivityIndicator, useColorScheme } from "react-native";
import { Pressable, Text } from "../../tw";

type Tone = "primary" | "muted" | "destructive";
type Variant = "solid" | "outline" | "ghost";

const container: Record<Tone, Record<Variant, string>> = {
	primary: {
		solid: "bg-primary",
		outline: "border border-primary bg-transparent",
		ghost: "bg-transparent",
	},
	muted: {
		solid: "bg-muted",
		outline: "border border-border bg-transparent",
		ghost: "bg-transparent",
	},
	destructive: {
		solid: "bg-destructive",
		outline: "border border-destructive bg-transparent",
		ghost: "bg-transparent",
	},
};

const label: Record<Tone, Record<Variant, string>> = {
	primary: {
		solid: "text-primary-foreground",
		outline: "text-primary",
		ghost: "text-primary",
	},
	muted: {
		solid: "text-foreground",
		outline: "text-foreground",
		ghost: "text-foreground",
	},
	destructive: {
		solid: "text-primary-foreground",
		outline: "text-destructive",
		ghost: "text-destructive",
	},
};

export function Button({
	children,
	onPress,
	tone = "primary",
	variant = "solid",
	disabled = false,
	loading = false,
	className = "",
}: {
	children: ReactNode;
	onPress?: () => void;
	tone?: Tone;
	variant?: Variant;
	disabled?: boolean;
	loading?: boolean;
	className?: string;
}) {
	const isDisabled = disabled || loading;
	const scheme = useColorScheme();
	const onPrimary = scheme === "dark" ? "#15141e" : "#ffffff";
	const accent = scheme === "dark" ? "#cbb8ff" : "#2c429d";
	const fg = scheme === "dark" ? "#e8e6ef" : "#302d50";
	const destructive = scheme === "dark" ? "#f3a3b1" : "#b34457";
	const spinnerColor =
		tone === "primary"
			? variant === "solid"
				? onPrimary
				: accent
			: tone === "destructive"
				? variant === "solid"
					? onPrimary
					: destructive
				: fg;
	return (
		<Pressable
			onPress={onPress}
			disabled={isDisabled}
			className={`flex-row items-center justify-center gap-2 rounded-lg px-4 py-3 ${container[tone][variant]} ${isDisabled ? "opacity-50" : ""} ${className}`}
		>
			{loading ? <ActivityIndicator size="small" color={spinnerColor} /> : null}
			<Text className={`font-bold text-sm ${label[tone][variant]}`}>
				{children}
			</Text>
		</Pressable>
	);
}
