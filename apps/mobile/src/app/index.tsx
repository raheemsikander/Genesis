import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";
import { Spinner } from "../components/ui";
import { View } from "../tw";

export default function Index() {
	const { isLoaded, isSignedIn } = useAuth();
	if (!isLoaded) {
		return (
			<View className="flex-1 items-center justify-center bg-background">
				<Spinner />
			</View>
		);
	}
	return (
		<Redirect href={isSignedIn ? "/(portal)/(tabs)" : "/(auth)/sign-in"} />
	);
}
