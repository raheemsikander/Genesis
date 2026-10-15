import { useSignUp } from "@clerk/expo";
import { useForm } from "@tanstack/react-form";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { z } from "zod";
import { FieldError } from "../../components/field-error";
import { SafeAreaView } from "../../components/safe-area-view";
import { Button, Input, Text } from "../../components/ui";
import { getClerkErrorMessage } from "../../utils/clerk-error";

const VerifyEmailSchema = z.object({
	code: z.string().length(6, "Enter the 6-digit code"),
});

export default function VerifyEmail() {
	const { signUp } = useSignUp();
	const router = useRouter();
	const { email } = useLocalSearchParams<{ email?: string }>();

	const [submitError, setSubmitError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: { code: "" },
		validators: { onChange: VerifyEmailSchema },
		onSubmit: async ({ value }) => {
			setSubmitError(null);
			const { error: verifyError } = await signUp.verifications.verifyEmailCode(
				{ code: value.code },
			);
			if (verifyError) {
				setSubmitError(getClerkErrorMessage(verifyError));
				return;
			}
			if (signUp.status === "complete") {
				await signUp.finalize({
					navigate: ({ session }) => {
						if (session?.currentTask) return;
					},
				});
				router.replace("/(portal)/(tabs)/(home)");
				return;
			}
			setSubmitError(
				"Your email is verified, but the account needs another step. Please sign in to continue.",
			);
		},
	});

	async function resend() {
		setSubmitError(null);
		const { error: sendError } = await signUp.verifications.sendEmailCode();
		if (sendError) setSubmitError(getClerkErrorMessage(sendError));
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

				<form.Field name="code">
					{(field) => (
						<>
							<Input
								value={field.state.value}
								onChangeText={field.handleChange}
								onBlur={field.handleBlur}
								placeholder="123456"
								keyboardType="number-pad"
								maxLength={6}
								className={
									field.state.meta.isTouched &&
									field.state.meta.errors.length > 0
										? "border-destructive"
										: undefined
								}
							/>
							<FieldError field={field} />
						</>
					)}
				</form.Field>

				{submitError ? (
					<Text className="text-destructive text-sm">{submitError}</Text>
				) : null}

				<form.Subscribe selector={(s) => s.isSubmitting}>
					{(isSubmitting) => (
						<Button
							label={isSubmitting ? "Verifying…" : "Verify"}
							onPress={() => form.handleSubmit()}
							loading={isSubmitting}
						/>
					)}
				</form.Subscribe>

				<Button label="Resend code" variant="ghost" onPress={resend} />
			</View>
		</SafeAreaView>
	);
}
