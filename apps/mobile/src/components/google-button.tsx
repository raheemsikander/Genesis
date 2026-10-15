import { useSSO } from "@clerk/expo";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Button, Text } from "./ui";

export function GoogleButton() {
	const { startSSOFlow } = useSSO();
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function onPress() {
		setError(null);
		setLoading(true);
		try {
			const result = await startSSOFlow({
				strategy: "oauth_google",
				redirectUrl: Linking.createURL("/sso-callback"),
			});
			if (result.createdSessionId && result.setActive) {
				await result.setActive({ session: result.createdSessionId });
				router.replace("/(portal)/(tabs)/(home)");
			} else if (
				result.authSessionResult &&
				result.authSessionResult.type !== "cancel" &&
				result.authSessionResult.type !== "dismiss" &&
				result.authSessionResult.type !== "opened"
			) {
				setError(
					"Google sign-in could not be completed. Please try again or use email sign-in.",
				);
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "Google sign-in failed");
		} finally {
			setLoading(false);
		}
	}

	return (
		<>
			<Button
				label="Continue with Google"
				variant="outline"
				onPress={onPress}
				loading={loading}
			/>
			{error ? <Text className="text-destructive text-sm">{error}</Text> : null}
		</>
	);
}
