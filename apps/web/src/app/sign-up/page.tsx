"use client";

import { useAuth, useSignUp as useClerkSignUp } from "@clerk/nextjs";
import { Roles, type UserRole, UserRoleEnum } from "@repo/shared";
import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Spinner } from "@repo/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { z } from "zod";
import googleIcon from "../../assets/images/google-icon.png";
import { PasswordInput } from "../../components/password-input";
import { PasswordStrengthMeter } from "../../components/password-strength-meter";
import { AnalyticsEvent, analytics } from "../../utils/analytics";
import { getClerkErrorMessage } from "../../utils/clerk-error";
import { isPasswordStringValid } from "../../utils/password";

const SignUpSchema = z
	.object({
		name: z.string().min(1, "Please enter name"),
		email: z
			.string()
			.min(1, "Please enter email")
			.email("Please enter a valid email address"),
		password: z.string().min(1, "Please enter password"),
		confirmPassword: z.string().min(1, "Please confirm password"),
		role: UserRoleEnum,
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

function SignUpContent() {
	const { signUp, errors, fetchStatus } = useClerkSignUp();
	const { isSignedIn } = useAuth();
	const router = useRouter();
	const searchParams = useSearchParams();
	const isInvitation = searchParams.has("__clerk_ticket");
	const [error, setError] = useState("");
	const [passwordValue, setPasswordValue] = useState("");
	const [passwordFocused, setPasswordFocused] = useState(false);
	const [googleLoading, setGoogleLoading] = useState(false);

	const isSubmitting = fetchStatus === "fetching";
	const isBusy = isSubmitting || googleLoading;

	const form = useForm({
		defaultValues: {
			name: "",
			email: "",
			password: "",
			confirmPassword: "",
			role: Roles.MEMBER as UserRole,
		},
		validators: {
			onChange: SignUpSchema,
		},
		onSubmit: async ({ value }) => {
			setError("");

			const passwordValid = isPasswordStringValid(value.password);
			if (!passwordValid) {
				return;
			}

			const emailValue = isInvitation
				? (signUp.emailAddress ?? "")
				: value.email;

			const { error: signUpError } = await signUp.password({
				emailAddress: emailValue,
				password: value.password,
				firstName: value.name.split(" ")[0] || value.name,
				lastName: value.name.split(" ").slice(1).join(" ") || undefined,
				unsafeMetadata: isInvitation ? undefined : { role: value.role },
			});

			if (signUpError) {
				setError(
					getClerkErrorMessage(
						signUpError,
						"We couldn't create your account. Please try again.",
					),
				);
				return;
			}

			if (signUp.status === "complete") {
				analytics.track(AnalyticsEvent.SIGN_UP, {
					method: "password",
					stage: "completed",
				});
				await signUp.finalize({
					navigate: ({ session, decorateUrl }) => {
						if (session?.currentTask) return;
						window.location.href = decorateUrl("/portal");
					},
				});
				return;
			}

			if (
				signUp.status === "missing_requirements" &&
				signUp.unverifiedFields.includes("email_address")
			) {
				await signUp.verifications.sendEmailCode();
				router.push(`/verify-email?email=${encodeURIComponent(emailValue)}`);
			} else {
				setError(
					"We couldn't finish creating your account. Please try again or contact support.",
				);
			}
		},
	});

	const password = passwordValue;

	// Already signed in — redirect to portal
	if (isSignedIn && !isInvitation) {
		window.location.href = "/portal";
		return null;
	}

	function handleGoogleSignUp() {
		// Track on click, not after auth completes — Clerk's sso-callback redirects
		// before any post-completion effect can fire reliably. sendBeacon (in
		// mixpanel.init) flushes the event before the hard nav to Google.
		// Page-of-origin tracking: this reflects user intent. OAuth outcomes can
		// diverge (existing Google identity → silent sign-in), so the SIGN_UP /
		// SIGN_IN split for OAuth is intent-accurate, not outcome-accurate.
		// stage: "initiated" — user may still cancel at Google's consent screen.
		analytics.track(AnalyticsEvent.SIGN_UP, {
			method: "oauth",
			stage: "initiated",
		});
		setGoogleLoading(true);
		signUp.sso({
			strategy: "oauth_google",
			redirectCallbackUrl: "/sign-in/sso-callback",
			redirectUrl: "/complete-profile",
		});
	}

	return (
		<Card className="w-full max-w-md">
			<CardHeader className="text-center">
				<CardTitle className="text-2xl">
					{isInvitation ? "Accept Invitation" : "Create Account"}
				</CardTitle>
				<CardDescription>
					{isInvitation
						? "Set up your password to join the team"
						: "Enter your details to create a new account"}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className="space-y-4"
				>
					<form.Field
						name="name"
						children={(field) => (
							<div className="space-y-2">
								<Label htmlFor="name">Full Name</Label>
								<Input
									id="name"
									name="name"
									type="text"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									aria-invalid={
										field.state.meta.isTouched &&
										field.state.meta.errors.length > 0
									}
								/>
								{field.state.meta.isTouched &&
									field.state.meta.errors.length > 0 && (
										<p className="invalid-input">
											{field.state.meta.errors[0]?.message}
										</p>
									)}
								{field.state.meta.errors.length === 0 &&
									errors?.fields?.firstName && (
										<p className="invalid-input">
											{errors.fields.firstName.message}
										</p>
									)}
							</div>
						)}
					/>

					<form.Field
						name="email"
						children={(field) => (
							<div className="space-y-2">
								<Label htmlFor="email">Email</Label>
								<Input
									id="email"
									name="email"
									type="email"
									readOnly={isInvitation}
									className={isInvitation ? "bg-muted" : ""}
									value={
										isInvitation
											? (signUp.emailAddress ?? "")
											: field.state.value
									}
									onChange={(e) => {
										field.handleChange(e.target.value);
										if (errors?.fields?.emailAddress) {
											signUp.reset?.();
										}
									}}
									onBlur={field.handleBlur}
									aria-invalid={
										field.state.meta.isTouched &&
										field.state.meta.errors.length > 0
									}
								/>
								{field.state.meta.isTouched &&
									field.state.meta.errors.length > 0 && (
										<p className="invalid-input">
											{field.state.meta.errors[0]?.message}
										</p>
									)}
								{field.state.meta.errors.length === 0 &&
									errors?.fields?.emailAddress && (
										<p className="invalid-input">
											{errors.fields.emailAddress.message}
										</p>
									)}
							</div>
						)}
					/>

					<form.Field
						name="password"
						children={(field) => (
							<div className="space-y-2">
								<Label htmlFor="password">Password</Label>
								<PasswordInput
									id="password"
									name="password"
									value={field.state.value}
									onChange={(e) => {
										field.handleChange(e.target.value);
										setPasswordValue(e.target.value);
									}}
									onFocus={() => setPasswordFocused(true)}
									onBlur={() => {
										setPasswordFocused(false);
										field.handleBlur();
									}}
								/>
								{field.state.meta.isTouched &&
									field.state.meta.errors.length > 0 && (
										<p className="invalid-input">
											{field.state.meta.errors[0]?.message}
										</p>
									)}
								{field.state.meta.errors.length === 0 &&
									errors?.fields?.password && (
										<p className="invalid-input">
											{errors.fields.password.message}
										</p>
									)}

								<PasswordStrengthMeter
									password={password}
									focused={passwordFocused}
								/>
							</div>
						)}
					/>

					<form.Field
						name="confirmPassword"
						children={(field) => (
							<div className="space-y-2">
								<Label htmlFor="confirmPassword">Confirm Password</Label>
								<PasswordInput
									id="confirmPassword"
									name="confirmPassword"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
								/>
								{field.state.meta.isTouched &&
									field.state.meta.errors.length > 0 && (
										<p className="invalid-input">
											{field.state.meta.errors[0]?.message}
										</p>
									)}
								{error && field.state.meta.errors.length === 0 && (
									<p className="invalid-input">{error}</p>
								)}
							</div>
						)}
					/>

					{!isInvitation && (
						<form.Field
							name="role"
							children={(field) => (
								<div className="space-y-2">
									<Label>Role</Label>
									<div className="flex gap-3">
										<Button
											type="button"
											tone="secondary"
											variant={
												field.state.value !== Roles.MEMBER ? "solid" : "outline"
											}
											className="flex-1"
											onClick={() => field.handleChange(Roles.MEMBER)}
										>
											Member
										</Button>
										<Button
											type="button"
											tone="secondary"
											variant={
												field.state.value !== Roles.ADMIN ? "solid" : "outline"
											}
											className="flex-1"
											onClick={() => field.handleChange(Roles.ADMIN)}
										>
											Admin
										</Button>
									</div>
								</div>
							)}
						/>
					)}

					<Button type="submit" className="w-full" disabled={isBusy}>
						{isSubmitting && <Spinner className="mr-2 size-4" />}
						{isSubmitting
							? "Creating account..."
							: isInvitation
								? "Join Team"
								: "Create Account"}
					</Button>
				</form>

				<div id="clerk-captcha" className="mt-4" />

				{!isInvitation && (
					<>
						<div className="my-6 flex items-center gap-3">
							<div className="h-px flex-1 bg-border" />
							<span className="text-muted-foreground text-sm">or</span>
							<div className="h-px flex-1 bg-border" />
						</div>

						<Button
							type="button"
							variant="outline"
							className="w-full"
							onClick={handleGoogleSignUp}
							disabled={isBusy}
						>
							{googleLoading ? (
								<Spinner className="mr-2 size-4" />
							) : (
								<Image
									src={googleIcon}
									alt=""
									width={18}
									height={18}
									className="mr-2"
								/>
							)}
							{googleLoading ? "Redirecting..." : "Sign up with Google"}
						</Button>
					</>
				)}

				<p className="mt-6 text-center text-muted-foreground text-sm">
					Already have an account?{" "}
					<a href="/sign-in" className="text-primary underline">
						Sign in
					</a>
				</p>
			</CardContent>
		</Card>
	);
}

export default function SignUpPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-4">
			<Suspense fallback={<Spinner className="size-8" />}>
				<SignUpContent />
			</Suspense>
		</div>
	);
}
