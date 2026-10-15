"use client";

import { useUser } from "@clerk/nextjs";
import { type ReactNode, useEffect, useRef } from "react";
import { analytics } from "../utils/analytics";

export function MixpanelProvider({ children }: { children: ReactNode }) {
	const { user, isSignedIn, isLoaded } = useUser();
	const wasSignedIn = useRef<boolean | null>(null);

	useEffect(() => {
		analytics.init();
	}, []);

	useEffect(() => {
		if (!isLoaded) return;

		if (isSignedIn && user) {
			analytics.identify(user.id);
			analytics.setUserProperties({
				$email: user.primaryEmailAddress?.emailAddress,
				$first_name: user.firstName ?? undefined,
				$last_name: user.lastName ?? undefined,
				$created: user.createdAt?.toISOString(),
			});
			wasSignedIn.current = true;
			return;
		}

		// Signed out — only fire reset if we previously saw a signed-in user
		// (avoids reset spam on initial load with no session).
		if (wasSignedIn.current === true) {
			analytics.reset();
		}
		wasSignedIn.current = false;
	}, [isLoaded, isSignedIn, user]);

	return <>{children}</>;
}
