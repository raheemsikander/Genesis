import {
	CircularProgressIndicator,
	Text as ComposeText,
	Button as FilledButton,
	FilledTonalButton,
	Host,
	OutlinedButton,
	Row,
	TextButton,
} from "@expo/ui/jetpack-compose";
import { useColorScheme, View } from "react-native";
import { nativeTokens, resolveScheme } from "../../theme/native-tokens";
import { cn } from "../../utils/cn";
import type { ButtonProps } from "./button-types";

const componentByVariant = {
	default: FilledButton,
	secondary: FilledTonalButton,
	outline: OutlinedButton,
	ghost: TextButton,
	link: TextButton,
	destructive: FilledButton,
} as const;

const destructiveColors = {
	light: {
		containerColor: nativeTokens.light.destructive,
		contentColor: nativeTokens.light.destructiveForeground,
	},
	dark: {
		containerColor: nativeTokens.dark.destructive,
		contentColor: nativeTokens.dark.destructiveForeground,
	},
};

/**
 * Material 3 Compose button (Android variant; iOS uses SwiftUI in
 * `button.ios.tsx`). Variants map onto the M3 button family; `destructive`
 * is a filled button tinted with the destructive tokens (M3 has no
 * destructive role).
 */
export function Button({
	label,
	onPress,
	variant = "default",
	size = "default",
	loading = false,
	disabled = false,
	className,
}: ButtonProps) {
	const scheme = useColorScheme();
	const ButtonComponent = componentByVariant[variant];
	const isDisabled = disabled || loading;
	const colors =
		variant === "destructive"
			? destructiveColors[resolveScheme(scheme)]
			: undefined;
	const contentPadding =
		size === "sm"
			? { top: 4, bottom: 4 }
			: size === "lg"
				? { top: 14, bottom: 14 }
				: undefined;

	return (
		// Native buttons hug their content; center them within the wrapper row.
		<View className={cn("items-center", className)}>
			<Host matchContents>
				<ButtonComponent
					onClick={onPress}
					enabled={!isDisabled}
					colors={colors}
					contentPadding={contentPadding}
				>
					{loading ? (
						<Row>
							<CircularProgressIndicator />
							<ComposeText> {label}</ComposeText>
						</Row>
					) : (
						<ComposeText>{label}</ComposeText>
					)}
				</ButtonComponent>
			</Host>
		</View>
	);
}
