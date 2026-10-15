"use client";

import { useAuth, useSignIn } from "@clerk/nextjs";
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
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { z } from "zod";
import googleIcon from "../../assets/images/google-icon.png";
import { PasswordInput } from "../../components/password-input";
import { AnalyticsEvent, analytics } from "../../utils/analytics";
import { getClerkErrorMessage } from "../../utils/clerk-error";

const SignInSchema = z.object({
	email: z
		.string()
		.min(1, "Please enter email")
		.email("Please enter a valid email address"),
	password: z.string().min(1, "Please enter password"),
});

function SignInContent() {
	const { signIn, errors, fetchStatus } = useSignIn();
	const { isSignedIn } = useAuth();
	const searchParams = useSearchParams();
	const raw = searchParams.get("redirect_url");
	const redirectUrl =
		raw?.startsWith("/") && !raw.startsWith("//") ? raw : "/portal";

	const [error, setError] = useState("");
	const [googleLoading, setGoogleLoading] = useState(false);

	const isSubmitting = fetchStatus === "fetching";
	const isBusy = isSubmitting || googleLoading;

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		validators: {
			onChange: SignInSchema,
		},
		onSubmit: async ({ value }) => {
			setError("");

			const { error: signInError } = await signIn.password({
				emailAddress: value.email,
				password: value.password,
			});

			if (signInError) {
				setError(
					getClerkErrorMessage(signInError, "Invalid email or password"),
				);
				return;
			}

			if (signIn.status === "complete") {
				analytics.track(AnalyticsEvent.SIGN_IN, {
					method: "password",
					stage: "completed",
				});
				await signIn.finalize({
					navigate: ({ session, decorateUrl }) => {
						if (session?.currentTask) return;
						window.location.href = decorateUrl(redirectUrl);
					},
				});
			}
		},
	});

	function handleGoogleSignIn() {
		// Track on click, not after auth completes — Clerk's sso-callback redirects
		// before any post-completion effect can fire reliably. sendBeacon (in
		// mixpanel.init) flushes the event before the hard nav to Google.
		// stage: "initiated" — user may still cancel at Google's consent screen.
		analytics.track(AnalyticsEvent.SIGN_IN, {
			method: "oauth",
			stage: "initiated",
		});
		setGoogleLoading(true);
		signIn.sso({
			strategy: "oauth_google",
			redirectCallbackUrl: "/sign-in/sso-callback",
			redirectUrl,
		});
	}

	// Already signed in — redirect to destination
	if (isSignedIn) {
		window.location.href = redirectUrl;
		return null;
	}

	return (
		<Card className="w-full max-w-md">
			<CardHeader className="text-center">
				<CardTitle className="text-2xl">Sign In</CardTitle>
				<CardDescription>
					Enter your credentials to access your account
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
						name="email"
						children={(field) => (
							<div className="space-y-2">
								<Label htmlFor="email">Email</Label>
								<Input
									id="email"
									name="email"
									type="email"
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
									errors?.fields?.identifier && (
										<p className="invalid-input">
											{errors.fields.identifier.message}
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
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
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
								<a
									href="/reset-password"
									className="text-primary text-xs underline"
								>
									Forgot password?
								</a>
							</div>
						)}
					/>

					{error &&
						!errors?.fields?.identifier &&
						!errors?.fields?.password && (
							<p className="invalid-input">{error}</p>
						)}

					<Button type="submit" className="w-full" disabled={isBusy}>
						{isSubmitting && <Spinner className="mr-2 size-4" />}
						{isSubmitting ? "Signing in..." : "Sign In"}
					</Button>
				</form>

				<div className="my-6 flex items-center gap-3">
					<div className="h-px flex-1 bg-border" />
					<span className="text-muted-foreground text-sm">or</span>
					<div className="h-px flex-1 bg-border" />
				</div>

				<Button
					type="button"
					variant="outline"
					className="w-full"
					onClick={handleGoogleSignIn}
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
					{googleLoading ? "Redirecting..." : "Sign in with Google"}
				</Button>

				<p className="mt-6 text-center text-muted-foreground text-sm">
					Don't have an account?{" "}
					<a href="/sign-up" className="text-primary underline">
						Sign up
					</a>
				</p>
			</CardContent>
		</Card>
	);
}

export default function SignInPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-4">
			<Suspense fallback={<Spinner className="size-8" />}>
				<SignInContent />
			</Suspense>
		</div>
	);
}
