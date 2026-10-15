import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";

export default function AuthLayout() {
	const { isLoaded, isSignedIn } = useAuth();
	if (isLoaded && isSignedIn) {
		return <Redirect href="/(portal)/(tabs)/(home)" />;
	}
	return <Stack screenOptions={{ headerShown: false }} />;
}
