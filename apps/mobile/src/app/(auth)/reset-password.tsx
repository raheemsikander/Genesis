import { useSignIn } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import { PasswordStrengthMeter } from "../../components/password-strength-meter";
import { Button, Input } from "../../components/ui";
import { SafeAreaView, Text, View } from "../../tw";
import { getClerkErrorMessage } from "../../utils/clerk-error";
import { isPasswordValid } from "../../utils/password";

type Step = "email" | "code" | "password";

export default function ResetPassword() {
	const { signIn } = useSignIn();
	const router = useRouter();
	const [step, setStep] = useState<Step>("email");
	const [email, setEmail] = useState("");
	const [code, setCode] = useState("");
	const [password, setPassword] = useState("");
	const [pwFocused, setPwFocused] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function sendEmail() {
		setError(null);
		setBusy(true);
		try {
			const { error: createError } = await signIn.create({ identifier: email });
			if (createError) return setError(getClerkErrorMessage(createError));
			const { error: sendError } =
				await signIn.resetPasswordEmailCode.sendCode();
			if (sendError) return setError(getClerkErrorMessage(sendError));
			setStep("code");
		} finally {
			setBusy(false);
		}
	}

	async function verifyCode() {
		setError(null);
		setBusy(true);
		try {
			const { error: verifyError } =
				await signIn.resetPasswordEmailCode.verifyCode({ code });
			if (verifyError) return setError(getClerkErrorMessage(verifyError));
			setStep("password");
		} finally {
			setBusy(false);
		}
	}

	async function submitPassword() {
		setError(null);
		if (!isPasswordValid(password)) {
			return setError("Password does not meet the requirements.");
		}
		setBusy(true);
		try {
			const { error: submitError } =
				await signIn.resetPasswordEmailCode.submitPassword({ password });
			if (submitError) return setError(getClerkErrorMessage(submitError));
			if (signIn.status === "complete") {
				await signIn.finalize({
					navigate: ({ session }) => {
						if (session?.currentTask) return;
					},
				});
				router.replace("/(portal)/(tabs)");
			}
		} finally {
			setBusy(false);
		}
	}

	return (
		<SafeAreaView className="flex-1 bg-background">
			<View className="flex-1 justify-center gap-4 p-6">
				<Text className="font-semibold text-3xl text-foreground">
					Reset password
				</Text>
				{step === "email" ? (
					<>
						<Input
							value={email}
							onChangeText={setEmail}
							placeholder="you@example.com"
							keyboardType="email-address"
							autoCapitalize="none"
						/>
						{error ? (
							<Text className="text-destructive text-sm">{error}</Text>
						) : null}
						<Button onPress={sendEmail} loading={busy}>
							Send code
						</Button>
					</>
				) : step === "code" ? (
					<>
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
						<Button onPress={verifyCode} loading={busy}>
							Verify code
						</Button>
					</>
				) : (
					<>
						<Input
							value={password}
							onChangeText={setPassword}
							onFocus={() => setPwFocused(true)}
							onBlur={() => setPwFocused(false)}
							placeholder="New password"
							secureTextEntry
							autoCapitalize="none"
						/>
						<PasswordStrengthMeter password={password} focused={pwFocused} />
						{error ? (
							<Text className="text-destructive text-sm">{error}</Text>
						) : null}
						<Button onPress={submitPassword} loading={busy}>
							Set new password
						</Button>
					</>
				)}
			</View>
		</SafeAreaView>
	);
}
