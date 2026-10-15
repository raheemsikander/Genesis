import { useSignUp } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Button, Input } from "../../components/ui";
import { SafeAreaView, Text, View } from "../../tw";
import { getClerkErrorMessage } from "../../utils/clerk-error";

export default function VerifyEmail() {
	const { signUp } = useSignUp();
	const router = useRouter();
	const { email } = useLocalSearchParams<{ email?: string }>();
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	async function submit() {
		setError(null);
		setSubmitting(true);
		try {
			const { error: verifyError } = await signUp.verifications.verifyEmailCode(
				{
					code,
				},
			);
			if (verifyError) {
				setError(getClerkErrorMessage(verifyError));
				return;
			}
			if (signUp.status === "complete") {
				await signUp.finalize({
					navigate: ({ session }) => {
						if (session?.currentTask) return;
					},
				});
				router.replace("/(portal)/(tabs)");
			}
		} finally {
			setSubmitting(false);
		}
	}

	async function resend() {
		setError(null);
		const { error: sendError } = await signUp.verifications.sendEmailCode();
		if (sendError) setError(getClerkErrorMessage(sendError));
	}

	return (
		<SafeAreaView className="flex-1 bg-background">
			<View className="flex-1 justify-center gap-4 p-6">
				<Text className="font-semibold text-3xl text-foreground">
					Verify your email
				</Text>
				<Text className="text-muted-foreground text-sm">
					Enter the 6-digit code sent to {email ?? "your email"}.
				</Text>
				<Input
					value={code}
					onChangeText={setCode}
					placeholder="123456"
					keyboardType="number-pad"
					maxLength={6}
				/>
				{error ? (
					<Text className="text-destructive text-sm">{error}</Text>
				) : null}
				<Button onPress={submit} loading={submitting}>
					Verify
				</Button>
				<Button tone="muted" variant="ghost" onPress={resend}>
					Resend code
				</Button>
			</View>
		</SafeAreaView>
	);
}
