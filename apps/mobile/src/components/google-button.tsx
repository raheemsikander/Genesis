import { useSSO } from "@clerk/expo";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text } from "../tw";
import { Button } from "./ui";

export function GoogleButton() {
	const { startSSOFlow } = useSSO();
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);

	async function onPress() {
		setError(null);
		try {
			const result = await startSSOFlow({
				strategy: "oauth_google",
				redirectUrl: Linking.createURL("/sso-callback"),
			});
			if (result.createdSessionId && result.setActive) {
				await result.setActive({ session: result.createdSessionId });
			}
			router.replace("/(portal)/(tabs)");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Google sign-in failed");
		}
	}

	return (
		<>
			<Button tone="muted" variant="outline" onPress={onPress}>
				Continue with Google
			</Button>
			{error ? <Text className="text-destructive text-sm">{error}</Text> : null}
		</>
	);
}
