import { useSignIn } from "@clerk/expo";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { View } from "react-native";
import { z } from "zod";
import { FieldError } from "../../components/field-error";
import { GoogleButton } from "../../components/google-button";
import { SafeAreaView } from "../../components/safe-area-view";
import { Button, Input, Text, TextLink } from "../../components/ui";
import { getClerkErrorMessage } from "../../utils/clerk-error";

const SignInSchema = z.object({
	email: z.string().email("Enter a valid email"),
	password: z.string().min(1, "Enter your password"),
});

export default function SignIn() {
	const { signIn } = useSignIn();
	const [submitError, setSubmitError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: { email: "", password: "" },
		validators: { onChange: SignInSchema },
		onSubmit: async ({ value }) => {
			setSubmitError(null);
			const { error } = await signIn.create({
				identifier: value.email,
				password: value.password,
			});
			if (error) {
				setSubmitError(getClerkErrorMessage(error));
				return;
			}
			if (signIn.status !== "complete") {
				setSubmitError("Additional steps are required to sign in.");
				return;
			}
			const { error: finalizeError } = await signIn.finalize();
			if (finalizeError) setSubmitError(getClerkErrorMessage(finalizeError));
		},
	});

	return (
		<SafeAreaView className="flex-1 bg-background">
			<View className="flex-1 justify-center gap-3 p-6">
				<Text className="font-semibold text-5xl text-foreground">Sign in</Text>
				<Text className="text-muted-foreground text-sm">
					Use your account from the web app.
				</Text>

				<form.Field name="email">
					{(field) => (
						<>
							<Input
								value={field.state.value}
								onChangeText={field.handleChange}
								onBlur={field.handleBlur}
								placeholder="you@example.com"
								keyboardType="email-address"
								autoCapitalize="none"
								autoCorrect={false}
								autoComplete="email"
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

				<form.Field name="password">
					{(field) => (
						<>
							<Input
								value={field.state.value}
								onChangeText={field.handleChange}
								onBlur={field.handleBlur}
								placeholder="Password"
								secureTextEntry
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
				</form.Field>

				<TextLink href="/(auth)/reset-password">Forgot password?</TextLink>

				{submitError ? (
					<Text className="text-destructive text-sm">{submitError}</Text>
				) : null}

				<form.Subscribe selector={(s) => s.isSubmitting}>
					{(isSubmitting) => (
						<Button
							label={isSubmitting ? "Signing in…" : "Sign in"}
							onPress={() => form.handleSubmit()}
							loading={isSubmitting}
							className="mt-2"
						/>
					)}
				</form.Subscribe>

				<Text className="text-center text-muted-foreground text-sm">or</Text>
				<GoogleButton />

				<View className="flex-row justify-center gap-1">
					<Text className="text-muted-foreground text-sm">No account?</Text>
					<TextLink href="/(auth)/sign-up">Sign up</TextLink>
				</View>
			</View>
		</SafeAreaView>
	);
}
