import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";
import { View } from "react-native";
import { Spinner } from "../../components/ui";
import { useNativeHeaderOptions } from "../../hooks/use-native-header-options";
import { AuthProvider } from "../../providers/auth-provider";

export default function PortalLayout() {
	const screenOptions = useNativeHeaderOptions();
	const { isLoaded, isSignedIn } = useAuth();
	if (!isLoaded) {
		return (
			<View className="flex-1 items-center justify-center bg-background">
				<Spinner />
			</View>
		);
	}
	if (!isSignedIn) {
		return <Redirect href="/(auth)/sign-in" />;
	}
	return (
		<AuthProvider>
			<Stack screenOptions={screenOptions}>
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
			</Stack>
		</AuthProvider>
	);
}
