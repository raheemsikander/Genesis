import { useSignUp } from "@clerk/expo";
import {
	isPasswordStringValid,
	Roles,
	type UserRole,
	UserRoleEnum,
} from "@repo/shared";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { z } from "zod";
import { FieldError } from "../../components/field-error";
import { GoogleButton } from "../../components/google-button";
import { PasswordStrengthMeter } from "../../components/password-strength-meter";
import { SafeAreaView } from "../../components/safe-area-view";
import { Button, Input, Label, Text, TextLink } from "../../components/ui";
import { getClerkErrorMessage } from "../../utils/clerk-error";

const SignUpSchema = z
	.object({
		name: z.string().min(1, "Please enter name"),
		email: z.string().min(1, "Please enter email").email("Enter a valid email"),
		password: z.string().min(1, "Please enter password"),
		confirmPassword: z.string().min(1, "Please confirm password"),
		role: UserRoleEnum,
	})
	.refine((d) => d.password === d.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

export default function SignUp() {
	const { signUp } = useSignUp();
	const router = useRouter();
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [pwFocused, setPwFocused] = useState(false);

	const form = useForm({
		defaultValues: {
			name: "",
			email: "",
			password: "",
			confirmPassword: "",
			role: Roles.MEMBER as UserRole,
		},
		validators: { onChange: SignUpSchema },
		onSubmit: async ({ value }) => {
			setSubmitError(null);
			if (!isPasswordStringValid(value.password)) {
				setSubmitError("Password does not meet the requirements.");
				return;
			}
			const { error } = await signUp.password({
				emailAddress: value.email,
				password: value.password,
				firstName: value.name.split(" ")[0] || value.name,
				lastName: value.name.split(" ").slice(1).join(" ") || undefined,
				unsafeMetadata: { role: value.role },
			});
			if (error) {
				setSubmitError(getClerkErrorMessage(error));
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
			if (
				signUp.status === "missing_requirements" &&
				signUp.unverifiedFields.includes("email_address")
			) {
				const { error: sendError } = await signUp.verifications.sendEmailCode();
				if (sendError) {
					setSubmitError(getClerkErrorMessage(sendError));
					return;
				}
				router.push({
					pathname: "/(auth)/verify-email",
					params: { email: value.email },
				});
			} else {
				setSubmitError(
					"We couldn't finish creating your account. Please try again or contact support.",
				);
			}
		},
	});

	return (
		<SafeAreaView className="flex-1 bg-background">
			<ScrollView contentContainerClassName="gap-3 p-6">
				<Text className="font-semibold text-4xl text-foreground">
					Create account
				</Text>

				<form.Field name="name">
					{(field) => (
						<Input
							value={field.state.value}
							onChangeText={field.handleChange}
							onBlur={field.handleBlur}
							placeholder="Full name"
						/>
					)}
				</form.Field>
				<form.Field name="email">
					{(field) => (
						<Input
							value={field.state.value}
							onChangeText={field.handleChange}
							onBlur={field.handleBlur}
							placeholder="you@example.com"
							keyboardType="email-address"
							autoCapitalize="none"
							autoCorrect={false}
						/>
					)}
				</form.Field>
				<form.Field name="password">
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
								placeholder="Password"
								secureTextEntry
								autoCapitalize="none"
							/>
							<PasswordStrengthMeter
								password={field.state.value}
								focused={pwFocused}
							/>
						</>
					)}
				</form.Field>
				<form.Field name="confirmPassword">
					{(field) => (
						<>
							<Input
								value={field.state.value}
								onChangeText={field.handleChange}
								onBlur={field.handleBlur}
								placeholder="Confirm password"
								secureTextEntry
								autoCapitalize="none"
							/>
							<FieldError field={field} />
						</>
					)}
				</form.Field>

				<Label>Role</Label>
				<form.Field name="role">
					{(field) => (
						<View className="flex-row gap-3">
							<View className="flex-1">
								<Button
									label="Member"
									variant={
										field.state.value === Roles.MEMBER ? "default" : "outline"
									}
									onPress={() => field.handleChange(Roles.MEMBER)}
								/>
							</View>
							<View className="flex-1">
								<Button
									label="Admin"
									variant={
										field.state.value === Roles.ADMIN ? "default" : "outline"
									}
									onPress={() => field.handleChange(Roles.ADMIN)}
								/>
							</View>
						</View>
					)}
				</form.Field>

				{submitError ? (
					<Text className="text-destructive text-sm">{submitError}</Text>
				) : null}

				<form.Subscribe selector={(s) => s.isSubmitting}>
					{(isSubmitting) => (
						<Button
							label={isSubmitting ? "Creating…" : "Create account"}
							onPress={() => form.handleSubmit()}
							loading={isSubmitting}
							className="mt-2"
						/>
					)}
				</form.Subscribe>

				<Text className="text-center text-muted-foreground text-sm">or</Text>
				<GoogleButton />

				<View className="flex-row justify-center gap-1">
					<Text className="text-muted-foreground text-sm">
						Have an account?
					</Text>
					<TextLink href="/(auth)/sign-in">Sign in</TextLink>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}
