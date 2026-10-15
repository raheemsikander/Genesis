import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

/** Third-party components need the withUniwind adapter for className support. */
export const SafeAreaView = withUniwind(RNSafeAreaView);
