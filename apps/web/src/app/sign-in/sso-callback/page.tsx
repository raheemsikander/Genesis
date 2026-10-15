"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Spinner } from "@repo/ui/components/spinner";

export default function SSOCallbackPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<AuthenticateWithRedirectCallback
				signUpFallbackRedirectUrl="/complete-profile"
				signInFallbackRedirectUrl="/portal"
			/>
			<Spinner className="size-8" />
		</div>
	);
}
