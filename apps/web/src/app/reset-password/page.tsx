"use client";

import { useSignIn } from "@clerk/nextjs";
import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@repo/ui/components/input-otp";
import { Label } from "@repo/ui/components/label";
import { Spinner } from "@repo/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { PasswordInput } from "../../components/password-input";
import { PasswordStrengthMeter } from "../../components/password-strength-meter";
import { getClerkErrorMessage } from "../../utils/clerk-error";
import { isPasswordStringValid } from "../../utils/password";

// ─── step 1: enter email ───────────────────────────────────────────────────────

const EmailStepSchema = z.object({
	email: z
		.string()
		.min(1, "Please enter email")
		.email("Please enter a valid email address"),
});

function EmailStep({
	signIn,
	errors,
	isBusy,
	onCodeSent,
}: {
	signIn: ReturnType<typeof useSignIn>["signIn"];
	errors: ReturnType<typeof useSignIn>["errors"];
	isBusy: boolean;
	onCodeSent: (email: string) => void;
}) {
	const [error, setError] = useState("");

	const form = useForm({
		defaultValues: { email: "" },
		validators: { onChange: EmailStepSchema },
		onSubmit: async ({ value }) => {
			setError("");

			const { error: createError } = await signIn.create({
				identifier: value.email,
			});
			if (createError) {
				setError(
					getClerkErrorMessage(
						createError,
						"We couldn't start the reset. Check your email and try again.",
					),
				);
				return;
			}

			const { error: sendError } =
				await signIn.resetPasswordEmailCode.sendCode();
			if (sendError) {
				setError(
					getClerkErrorMessage(
						sendError,
						"We couldn't send the reset code. Please try again.",
					),
				);
				return;
			}

			onCodeSent(value.email);
		},
	});

	return (
		<>
			<CardHeader className="text-center">
				<CardTitle className="text-2xl">Forgot Password</CardTitle>
				<CardDescription>
					Enter your email and we'll send you a reset code
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

					{error && !errors?.fields?.identifier && (
						<p className="invalid-input">{error}</p>
					)}

					<Button type="submit" className="w-full" disabled={isBusy}>
						{isBusy && <Spinner className="mr-2 size-4" />}
						{isBusy ? "Sending code..." : "Send Reset Code"}
					</Button>
				</form>

				<p className="mt-4 text-center text-muted-foreground text-sm">
					<a href="/sign-in" className="text-primary underline">
						Back to sign in
					</a>
				</p>
			</CardContent>
		</>
	);
}

// ─── step 2: verify code ───────────────────────────────────────────────────────

function CodeStep({
	signIn,
	isBusy,
	email,
}: {
	signIn: ReturnType<typeof useSignIn>["signIn"];
	isBusy: boolean;
	email: string;
}) {
	const [code, setCode] = useState("");
	const [codeError, setCodeError] = useState("");

	const codeComplete = code.length === 6;

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!codeComplete) return;
		setCodeError("");

		const { error } = await signIn.resetPasswordEmailCode.verifyCode({
			code,
		});
		if (error) {
			setCodeError(getClerkErrorMessage(error, "Incorrect code"));
			return;
		}
	}

	async function handleResend() {
		setCodeError("");

		const { error } = await signIn.resetPasswordEmailCode.sendCode();
		if (error) {
			setCodeError(
				getClerkErrorMessage(error, "Failed to resend the code. Try again."),
			);
		}
	}

	return (
		<>
			<CardHeader className="text-center">
				<CardTitle className="text-2xl">Check Your Email</CardTitle>
				<CardDescription>
					We sent a 6-digit code to{" "}
					<strong className="text-foreground">{email}</strong>
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="flex justify-center">
						<InputOTP
							maxLength={6}
							value={code}
							onChange={(val) => {
								setCode(val);
								setCodeError("");
							}}
							disabled={isBusy}
						>
							<InputOTPGroup>
								{Array.from({ length: 6 }, (_, i) => (
									<InputOTPSlot key={i} index={i} />
								))}
							</InputOTPGroup>
						</InputOTP>
					</div>

					{codeError && (
						<p className="invalid-input text-center">{codeError}</p>
					)}

					<Button
						type="submit"
						className="w-full"
						disabled={!codeComplete || isBusy}
					>
						{isBusy && <Spinner className="mr-2 size-4" />}
						{isBusy ? "Verifying..." : "Verify Code"}
					</Button>
				</form>

				<p className="mt-4 text-center text-muted-foreground text-sm">
					Didn't receive the code?{" "}
					<button
						type="button"
						onClick={handleResend}
						className="text-primary underline"
					>
						Resend
					</button>
				</p>
			</CardContent>
		</>
	);
}

// ─── step 3: new password ──────────────────────────────────────────────────────

const NewPasswordSchema = z
	.object({
		password: z.string().min(1, "Please enter a new password"),
		confirmPassword: z.string().min(1, "Please confirm your password"),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

function NewPasswordStep({
	signIn,
	errors,
	isBusy,
	onCompleting,
	onNeedsSignIn,
}: {
	signIn: ReturnType<typeof useSignIn>["signIn"];
	errors: ReturnType<typeof useSignIn>["errors"];
	onCompleting: () => void;
	onNeedsSignIn: () => void;
	isBusy: boolean;
}) {
	const [passwordValue, setPasswordValue] = useState("");
	const [passwordFocused, setPasswordFocused] = useState(false);
	const [submitError, setSubmitError] = useState("");

	const form = useForm({
		defaultValues: {
			password: "",
			confirmPassword: "",
		},
		validators: {
			onChange: NewPasswordSchema,
		},
		onSubmit: async ({ value }) => {
			const passwordValid = isPasswordStringValid(value.password);
			if (!passwordValid) return;

			setSubmitError("");

			const { error } = await signIn.resetPasswordEmailCode.submitPassword({
				password: value.password,
			});
			if (error) {
				setSubmitError(
					getClerkErrorMessage(
						error,
						"We couldn't reset your password. Please try again.",
					),
				);
				return;
			}

			if (signIn.status === "complete") {
				onCompleting();
				await signIn.finalize({
					navigate: ({ session, decorateUrl }) => {
						if (session?.currentTask) return;
						window.location.href = decorateUrl("/portal");
					},
				});
			} else {
				/**
				 * Password was changed but sign-in needs an additional factor (e.g.
				 * MFA). Route to sign-in so the user completes the remaining step
				 * through the normal flow rather than leaving them on a dead-end screen.
				 */
				onNeedsSignIn();
			}
		},
	});

	const password = passwordValue;

	return (
		<>
			<CardHeader className="text-center">
				<CardTitle className="text-2xl">Set New Password</CardTitle>
				<CardDescription>
					Choose a strong password for your account
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
						name="password"
						children={(field) => (
							<div className="space-y-2">
								<Label htmlFor="password">New Password</Label>
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
								<Label htmlFor="confirmPassword">Confirm New Password</Label>
								<Input
									id="confirmPassword"
									type="password"
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
							</div>
						)}
					/>

					{submitError && !errors?.fields?.password && (
						<p className="invalid-input">{submitError}</p>
					)}

					<Button type="submit" className="w-full" disabled={isBusy}>
						{isBusy && <Spinner className="mr-2 size-4" />}
						{isBusy ? "Resetting..." : "Reset Password"}
					</Button>
				</form>
			</CardContent>
		</>
	);
}

// ─── page ──────────────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
	const { signIn, errors, fetchStatus } = useSignIn();
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [codeSent, setCodeSent] = useState(false);
	const [completing, setCompleting] = useState(false);

	const isBusy = fetchStatus === "fetching";

	const showNewPassword = signIn.status === "needs_new_password" && !completing;

	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-4">
			{completing ? (
				<Spinner className="size-8" />
			) : (
				<Card className="w-full max-w-md">
					{showNewPassword ? (
						<NewPasswordStep
							signIn={signIn}
							errors={errors}
							isBusy={isBusy}
							onCompleting={() => setCompleting(true)}
							onNeedsSignIn={() => router.push("/sign-in")}
						/>
					) : codeSent ? (
						<CodeStep signIn={signIn} isBusy={isBusy} email={email} />
					) : (
						<EmailStep
							signIn={signIn}
							errors={errors}
							isBusy={isBusy}
							onCodeSent={(addr) => {
								setEmail(addr);
								setCodeSent(true);
							}}
						/>
					)}
				</Card>
			)}
		</div>
	);
}
