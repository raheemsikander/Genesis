"use client";

import { useSignUp } from "@clerk/nextjs";
import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@repo/ui/components/input-otp";
import { Spinner } from "@repo/ui/components/spinner";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { getClerkErrorMessage } from "../../utils/clerk-error";

function VerifyEmailContent() {
	const { signUp, fetchStatus } = useSignUp();
	const searchParams = useSearchParams();
	const email = searchParams.get("email") ?? "";
	const [code, setCode] = useState("");
	const [error, setError] = useState("");

	const isLoading = fetchStatus === "fetching";
	const codeComplete = code.length === 6;

	async function handleVerify(e: React.FormEvent) {
		e.preventDefault();
		if (!codeComplete) return;
		setError("");

		const { error: verifyError } = await signUp.verifications.verifyEmailCode({
			code,
		});

		if (verifyError) {
			setError(getClerkErrorMessage(verifyError, "Invalid verification code"));
			return;
		}

		if (signUp.status === "complete") {
			await signUp.finalize({
				navigate: ({ session, decorateUrl }) => {
					if (session?.currentTask) return;
					window.location.href = decorateUrl("/portal");
				},
			});
		} else {
			setError(
				"Your email is verified, but the account needs another step. Please sign in to continue.",
			);
		}
	}

	async function handleResend() {
		try {
			await signUp.verifications.sendEmailCode();
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : "Failed to resend code";
			setError(message);
		}
	}

	return (
		<Card className="w-full max-w-md">
			<CardHeader className="text-center">
				<CardTitle className="text-2xl">Verify Your Email</CardTitle>
				<CardDescription>
					We sent a 6-digit code to{" "}
					<strong className="text-foreground">{email || "your email"}</strong>
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleVerify} className="space-y-4">
					<div className="flex justify-center">
						<InputOTP
							maxLength={6}
							value={code}
							onChange={(val) => {
								setCode(val);
								setError("");
							}}
							disabled={isLoading}
						>
							<InputOTPGroup>
								{Array.from({ length: 6 }, (_, i) => (
									<InputOTPSlot key={i} index={i} />
								))}
							</InputOTPGroup>
						</InputOTP>
					</div>

					{error && <p className="invalid-input text-center">{error}</p>}

					<Button
						type="submit"
						className="w-full"
						disabled={!codeComplete || isLoading}
					>
						{isLoading && <Spinner className="mr-2 size-4" />}
						{isLoading ? "Verifying..." : "Verify Email"}
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
		</Card>
	);
}

export default function VerifyEmailPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-4">
			<Suspense fallback={<Spinner className="size-8" />}>
				<VerifyEmailContent />
			</Suspense>
		</div>
	);
}
