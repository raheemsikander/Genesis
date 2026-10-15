import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";
import { Spinner } from "../../components/ui";
import { AuthProvider } from "../../providers/auth-provider";
import { View } from "../../tw";

export default function PortalLayout() {
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
			<Stack screenOptions={{ headerShown: true }}>
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
			</Stack>
		</AuthProvider>
	);
}
