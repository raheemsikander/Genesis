"use client";

import { useClerk, useAuth as useClerkAuth } from "@clerk/nextjs";
import { Spinner } from "@repo/ui/components/spinner";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";
import { redirect, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "../../components/app-header";
import { AppSidebar } from "../../components/app-sidebar";
import { navigationItems } from "../../config/navigation-items";
import { isUserAuthorizedForRoute } from "../../config/route-access";
import { useAuth } from "../../hooks/use-auth";
import { AuthProvider } from "../../providers/auth-provider";
import { BreadcrumbProvider } from "../../providers/breadcrumb-provider";
import {
	SidebarControlProvider,
	useSidebarControl,
} from "../../providers/sidebar-control-provider";
import { AnalyticsEvent, analytics } from "../../utils/analytics";
import { filterNavItemsByRole } from "./_helpers/filter-nav-items";

function PortalContent({ children }: { children: React.ReactNode }) {
	const { isPermanentlyExpanded, handleManualToggle } = useSidebarControl();
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const { user } = useAuth();
	const isMobile = useIsMobile();

	const sidebarEffectivelyOpen = sidebarOpen || isPermanentlyExpanded;
	// On mobile the sidebar is an overlay above content — no margin reserved.
	const contentOffset = isMobile
		? "ml-0"
		: sidebarEffectivelyOpen
			? "ml-60"
			: "ml-14";
	const showBackdrop = isMobile === true && sidebarEffectivelyOpen;

	useEffect(() => {
		if (!showBackdrop) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") handleManualToggle();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [showBackdrop, handleManualToggle]);

	useEffect(() => {
		if (!showBackdrop) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [showBackdrop]);

	const visibleNav = useMemo(
		() => filterNavItemsByRole(navigationItems, user?.role),
		[user?.role],
	);

	return (
		<>
			{showBackdrop && (
				<button
					type="button"
					aria-label="Close sidebar"
					onClick={handleManualToggle}
					className="fixed inset-0 z-40 bg-overlay"
				/>
			)}
			<AppSidebar
				navigationItems={visibleNav}
				isOpen={sidebarOpen}
				onOpenChange={setSidebarOpen}
			/>
			<div
				className={`flex min-h-screen flex-col transition-[margin] duration-200 ${contentOffset}`}
			>
				<AppHeader />
				<main className="flex-1" inert={showBackdrop || undefined}>
					{children}
				</main>
			</div>
		</>
	);
}

function PortalErrorScreen({ onRetry }: { onRetry: () => void }) {
	return (
		<div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-center">
			<p className="text-lg">We couldn't load your account.</p>
			<p className="text-muted-foreground text-sm">
				Please try again. If the problem persists, sign out and back in.
			</p>
			<button
				type="button"
				onClick={onRetry}
				className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
			>
				Retry
			</button>
		</div>
	);
}

function PortalRoleGuard({ children }: { children: React.ReactNode }) {
	const { user, isLoading, isError, error, refetch } = useAuth();
	const { signOut } = useClerk();
	const pathname = usePathname();

	const errorCode = (error as { code?: string } | null)?.code;
	const isAuthError = isError && errorCode === "UNAUTHORIZED";

	useEffect(() => {
		if (isAuthError) {
			analytics.track(AnalyticsEvent.SIGN_OUT, {
				reason: "auth_error_occurred",
			});
			void signOut({ redirectUrl: "/" });
		}
	}, [isAuthError, signOut]);

	if (isLoading) {
		return (
			<div className="flex h-screen items-center justify-center bg-background">
				<Spinner className="size-8" />
			</div>
		);
	}

	if (isAuthError) {
		// Sign-out is in progress (kicked off by the effect above);
		// render a spinner so we don't flash the error screen.
		return (
			<div className="flex h-screen items-center justify-center bg-background">
				<Spinner className="size-8" />
			</div>
		);
	}

	if (isError) {
		return (
			<PortalErrorScreen
				onRetry={() => {
					void refetch();
				}}
			/>
		);
	}

	if (!user) return null;

	if (!isUserAuthorizedForRoute(pathname, user.role)) {
		// If /portal itself is restricted and the user isn't allowed, bouncing
		// back to /portal would loop. Send them to marketing instead.
		redirect(pathname === "/portal" ? "/" : "/portal");
	}

	return <PortalContent>{children}</PortalContent>;
}

export default function PortalLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { isSignedIn, isLoaded } = useClerkAuth();

	if (isLoaded && !isSignedIn) {
		redirect("/sign-in");
	}

	if (!isLoaded) {
		return (
			<div className="flex h-screen items-center justify-center bg-background">
				<Spinner className="size-8" />
			</div>
		);
	}

	return (
		<AuthProvider>
			<SidebarControlProvider>
				<BreadcrumbProvider>
					<PortalRoleGuard>{children}</PortalRoleGuard>
				</BreadcrumbProvider>
			</SidebarControlProvider>
		</AuthProvider>
	);
}
