import { useColorScheme } from "react-native";
import { nativeTokens, resolveScheme } from "../theme/native-tokens";

/**
 * Active tint for the native tab bar (Android variant; iOS lives in
 * `use-tab-tint-color.ios.ts`). Values come from src/theme/native-tokens.ts
 * since native chrome can't read className.
 */
export function useTabTintColor() {
	const scheme = useColorScheme();
	return nativeTokens[resolveScheme(scheme)].primary;
}
