"use client";

import { useUser } from "@clerk/nextjs";
import { Toaster } from "@repo/ui/components/sonner";
import { Provider as RollbarProvider, useRollbar } from "@rollbar/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect } from "react";
import { env } from "../utils/env";
import { rollbarConfig } from "../utils/rollbar";
import { queryClient } from "../utils/tanstack-query";

import { MixpanelProvider } from "./mixpanel-provider";
import { ThemeProvider } from "./theme-provider";

// Syncs Clerk user identity to Rollbar so all error reports include who was signed in
function RollbarUserSync({ children }: { children: React.ReactNode }) {
	const rollbar = useRollbar();
	const { user, isSignedIn } = useUser();
	const userId = user?.id;
	const email = user?.primaryEmailAddress?.emailAddress;

	useEffect(() => {
		rollbar.configure({
			payload: {
				person: isSignedIn && userId ? { id: userId, email } : undefined,
			},
		});
	}, [isSignedIn, userId, email, rollbar]);

	return children;
}

export default function Providers({ children }: { children: React.ReactNode }) {
	return (
		<RollbarProvider config={rollbarConfig}>
			<RollbarUserSync>
				<MixpanelProvider>
					<ThemeProvider
						attribute="class"
						defaultTheme="system"
						enableSystem
						disableTransitionOnChange
					>
						<QueryClientProvider client={queryClient}>
							{children}
							{env.NEXT_PUBLIC_NODE_ENV === "development" && (
								<ReactQueryDevtools />
							)}
						</QueryClientProvider>
						<Toaster richColors />
					</ThemeProvider>
				</MixpanelProvider>
			</RollbarUserSync>
		</RollbarProvider>
	);
}
