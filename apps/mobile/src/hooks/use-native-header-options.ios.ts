import { useColorScheme } from "react-native";
import { nativeTokens, resolveScheme } from "../theme/native-tokens";

/**
 * iOS native stack header styling (Metro resolves this over the base file).
 *
 * With `largeTitle` the header is a transparent large-title header with system
 * blur when content scrolls under it (scroll-edge/liquid-glass effect on
 * iOS 26+). Screens under it must put a ScrollView/FlatList first with
 * `contentInsetAdjustmentBehavior="automatic"` so content is inset correctly.
 * Detail screens keep an opaque token-tinted header.
 */
export function useNativeHeaderOptions({ largeTitle = false } = {}) {
	const scheme = useColorScheme();
	const colors = nativeTokens[resolveScheme(scheme)];

	if (largeTitle) {
		return {
			headerLargeTitle: true,
			headerTransparent: true,
			/**
			 * No explicit blur: iOS 26's scroll-edge effect supplies the
			 * scrolled-under appearance natively, and RNScreens warns that
			 * combining it with `headerBlurEffect` causes overlapping effects.
			 */
			headerBlurEffect: "none" as const,
			headerShadowVisible: false,
			headerLargeStyle: { backgroundColor: "transparent" },
			/**
			 * A transparent header has no theme background, so the title/back
			 * tint must be set explicitly or it defaults to light-theme black
			 * and vanishes against the dark background.
			 */
			headerTintColor: colors.foreground,
			headerTitleStyle: { color: colors.foreground },
			headerLargeTitleStyle: { color: colors.foreground },
		};
	}

	return {
		headerStyle: { backgroundColor: colors.background },
		headerTintColor: colors.foreground,
		headerShadowVisible: false,
	};
}
