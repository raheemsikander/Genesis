"use client";

import { useUser } from "@clerk/nextjs";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { type ReactNode, Suspense, useEffect, useRef } from "react";
import {
	googleAnalytics,
	googleAnalyticsScriptSrc,
	isGoogleAnalyticsEnabled,
} from "../utils/google-analytics";

export function GoogleAnalyticsPageView() {
	const pathname = usePathname();
	const search = useSearchParams().toString();

	useEffect(() => {
		googleAnalytics.trackPageView(pathname, search);
	}, [pathname, search]);

	return null;
}

export function GoogleAnalyticsProvider({ children }: { children: ReactNode }) {
	const { user, isSignedIn, isLoaded } = useUser();
	const wasSignedIn = useRef(false);
	const enabled = isGoogleAnalyticsEnabled();
	const scriptSrc = googleAnalyticsScriptSrc();

	useEffect(() => {
		if (!enabled) return;
		googleAnalytics.init();
	}, [enabled]);

	useEffect(() => {
		if (!isLoaded) return;

		if (isSignedIn && user) {
			googleAnalytics.setUserId(user.id);
			wasSignedIn.current = true;
			return;
		}

		// Only break the identity link if we actually established one, so a visitor who was
		// never signed in does not get a stray clear on every load.
		if (wasSignedIn.current) {
			googleAnalytics.setUserId(null);
		}
		wasSignedIn.current = false;
	}, [isLoaded, isSignedIn, user]);

	return (
		<>
			{enabled && scriptSrc && (
				<Script src={scriptSrc} strategy="afterInteractive" />
			)}
			{/* useSearchParams suspends during static rendering; the boundary keeps that
			    contained to the tracker instead of the whole app. */}
			<Suspense fallback={null}>
				<GoogleAnalyticsPageView />
			</Suspense>
			{children}
		</>
	);
}
