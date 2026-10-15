import { useSignIn } from "@clerk/expo";
import { isPasswordStringValid } from "@repo/shared";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { z } from "zod";
import { FieldError } from "../../components/field-error";
import { PasswordStrengthMeter } from "../../components/password-strength-meter";
import { SafeAreaView } from "../../components/safe-area-view";
import { Button, Input, Text } from "../../components/ui";
import { getClerkErrorMessage } from "../../utils/clerk-error";

type Step = "email" | "password";

const EmailSchema = z.object({
	email: z.string().email("Enter a valid email"),
});

const PasswordSchema = z.object({
	code: z.string().length(6, "Enter the 6-digit code"),
	password: z.string().min(1, "Enter a new password"),
});

export default function ResetPassword() {
	const { signIn } = useSignIn();
	const router = useRouter();
	const [step, setStep] = useState<Step>("email");
	const [pwFocused, setPwFocused] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	const emailForm = useForm({
		defaultValues: { email: "" },
		validators: { onChange: EmailSchema },
		onSubmit: async ({ value }) => {
			setSubmitError(null);
			const { error: createError } = await signIn.create({
				identifier: value.email,
			});
			if (createError) {
				setSubmitError(getClerkErrorMessage(createError));
				return;
			}
			const { error: sendError } =
				await signIn.resetPasswordEmailCode.sendCode();
			if (sendError) {
				setSubmitError(getClerkErrorMessage(sendError));
				return;
			}
			setStep("password");
		},
	});

	const passwordForm = useForm({
		defaultValues: { code: "", password: "" },
		validators: { onChange: PasswordSchema },
		onSubmit: async ({ value }) => {
			setSubmitError(null);
			if (!isPasswordStringValid(value.password)) {
				setSubmitError("Password does not meet the requirements.");
				return;
			}
			const { error: verifyError } =
				await signIn.resetPasswordEmailCode.verifyCode({ code: value.code });
			if (verifyError) {
				setSubmitError(getClerkErrorMessage(verifyError));
				return;
			}
			const { error: submitError } =
				await signIn.resetPasswordEmailCode.submitPassword({
					password: value.password,
				});
			if (submitError) {
				setSubmitError(getClerkErrorMessage(submitError));
				return;
			}
			if (signIn.status === "complete") {
				await signIn.finalize({
					navigate: ({ session }) => {
						if (session?.currentTask) return;
					},
				});
				router.replace("/(portal)/(tabs)/(home)");
				return;
			}
			/** Password was changed but additional factors are required (e.g. 2FA). */
			router.replace("/(auth)/sign-in");
		},
	});

	return (
		<SafeAreaView className="flex-1 bg-background">
			<View className="flex-1 justify-center gap-4 p-6">
				<Text className="font-semibold text-3xl text-foreground">
					Reset password
				</Text>

				{step === "email" ? (
					<>
						<emailForm.Field name="email">
							{(field) => (
								<>
									<Input
										value={field.state.value}
										onChangeText={field.handleChange}
										onBlur={field.handleBlur}
										placeholder="you@example.com"
										keyboardType="email-address"
										autoCapitalize="none"
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
						</emailForm.Field>

						{submitError ? (
							<Text className="text-destructive text-sm">{submitError}</Text>
						) : null}

						<emailForm.Subscribe selector={(s) => s.isSubmitting}>
							{(isSubmitting) => (
								<Button
									label={isSubmitting ? "Sending…" : "Send code"}
									onPress={() => emailForm.handleSubmit()}
									loading={isSubmitting}
								/>
							)}
						</emailForm.Subscribe>
					</>
				) : (
					<>
						<passwordForm.Field name="code">
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
						</passwordForm.Field>

						<passwordForm.Field name="password">
							{(field) => (
								<>
									<Input
										value={field.state.value}
										onChangeText={field.handleChange}
										onBlur={() => {
											field.handleBlur();
											setPwFocused(false);
										}}
										onFocus={() => setPwFocused(true)}
										placeholder="New password"
										secureTextEntry
										autoCapitalize="none"
										className={
											field.state.meta.isTouched &&
											field.state.meta.errors.length > 0
												? "border-destructive"
												: undefined
										}
									/>
									<PasswordStrengthMeter
										password={field.state.value}
										focused={pwFocused}
									/>
									<FieldError field={field} />
								</>
							)}
						</passwordForm.Field>

						{submitError ? (
							<Text className="text-destructive text-sm">{submitError}</Text>
						) : null}

						<passwordForm.Subscribe selector={(s) => s.isSubmitting}>
							{(isSubmitting) => (
								<Button
									label={isSubmitting ? "Saving…" : "Set new password"}
									onPress={() => passwordForm.handleSubmit()}
									loading={isSubmitting}
								/>
							)}
						</passwordForm.Subscribe>
					</>
				)}
			</View>
		</SafeAreaView>
	);
}
