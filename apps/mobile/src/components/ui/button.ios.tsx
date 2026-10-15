import {
	Host,
	HStack,
	ProgressView,
	Button as SwiftUIButton,
	Text as SwiftUIText,
} from "@expo/ui/swift-ui";
import {
	buttonStyle,
	controlSize,
	disabled as disabledModifier,
	tint,
} from "@expo/ui/swift-ui/modifiers";
import { useColorScheme, View } from "react-native";
import { nativeTokens, resolveScheme } from "../../theme/native-tokens";
import { cn } from "../../utils/cn";
import type { ButtonProps } from "./button-types";

const styleByVariant = {
	default: "borderedProminent",
	secondary: "bordered",
	outline: "bordered",
	ghost: "borderless",
	link: "borderless",
	destructive: "borderedProminent",
} as const;

const controlSizeBySize = {
	sm: "small",
	default: "regular",
	lg: "large",
} as const;

const primaryTint = {
	light: nativeTokens.light.primary,
	dark: nativeTokens.dark.primary,
};

/**
 * Native SwiftUI button (iOS variant; Android uses Material 3 Compose in
 * `button.android.tsx`). `destructive` relies on the SwiftUI button role for
 * the system red; all other variants are tinted with the primary token, the
 * same way an app-wide accent color would be.
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
	const isDisabled = disabled || loading;
	const modifiers = [
		buttonStyle(styleByVariant[variant]),
		controlSize(controlSizeBySize[size]),
		disabledModifier(isDisabled),
	];
	if (variant !== "destructive") {
		modifiers.push(tint(primaryTint[resolveScheme(scheme)]));
	}

	return (
		// Native buttons hug their content; center them within the wrapper row.
		<View className={cn("items-center", className)}>
			<Host matchContents>
				<SwiftUIButton
					role={variant === "destructive" ? "destructive" : undefined}
					onPress={onPress}
					modifiers={modifiers}
				>
					{loading ? (
						<HStack spacing={8}>
							<ProgressView />
							<SwiftUIText>{label}</SwiftUIText>
						</HStack>
					) : (
						<SwiftUIText>{label}</SwiftUIText>
					)}
				</SwiftUIButton>
			</Host>
		</View>
	);
}
