import { useColorScheme } from "react-native";
import { nativeTokens, resolveScheme } from "../theme/native-tokens";

/**
 * Shared native stack header styling (Android variant; iOS lives in
 * `use-native-header-options.ios.ts` per the platform-extension convention).
 *
 * Headers are opaque and tinted with the design tokens so they follow the
 * system color scheme. `largeTitle` is an iOS-only concept and is ignored here.
 */
export function useNativeHeaderOptions(
	_options: { largeTitle?: boolean } = {},
) {
	const scheme = useColorScheme();
	const colors = nativeTokens[resolveScheme(scheme)];
	return {
		headerStyle: { backgroundColor: colors.background },
		headerTintColor: colors.foreground,
		headerShadowVisible: false,
	};
}
