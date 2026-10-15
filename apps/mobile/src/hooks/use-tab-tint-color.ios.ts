import { DynamicColorIOS } from "react-native";
import { nativeTokens } from "../theme/native-tokens";

/**
 * Active tint for the native tab bar on iOS. `DynamicColorIOS` adapts between
 * appearances natively (including against liquid glass on iOS 26+). Values
 * come from src/theme/native-tokens.ts since native chrome can't read className.
 */
export function useTabTintColor() {
	return DynamicColorIOS({
		light: nativeTokens.light.primary,
		dark: nativeTokens.dark.primary,
	});
}
