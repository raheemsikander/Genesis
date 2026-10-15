import "../global.css";

import { Slot } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Providers } from "../providers/providers";

WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
	return (
		<SafeAreaProvider>
			<Providers>
				<Slot />
			</Providers>
		</SafeAreaProvider>
	);
}
