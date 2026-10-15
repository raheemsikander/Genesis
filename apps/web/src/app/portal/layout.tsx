"use client";

import { useClerk, useAuth as useClerkAuth } from "@clerk/nextjs";
import { Spinner } from "@repo/ui/components/spinner";
import {
	FunctionSquare,
	HardDriveIcon,
	HomeIcon,
	InfoIcon,
	MailIcon,
	PaletteIcon,
	PanelLeftIcon,
	TextIcon,
	UserIcon,
	UsersIcon,
} from "lucide-react";
import { redirect, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "../../components/app-header";
import { AppSidebar, type NavigationItem } from "../../components/app-sidebar";
import { isUserAuthorizedForRoute } from "../../config/route-access";
import { useAuth } from "../../hooks/use-auth";
import { AuthProvider } from "../../providers/auth-provider";
import {
	SidebarControlProvider,
	useSidebarControl,
} from "../../providers/sidebar-control-provider";
import { AnalyticsEvent, analytics } from "../../utils/analytics";
import { filterNavItemsByRole } from "./_helpers/filter-nav-items";

const navigationItems: NavigationItem[] = [
	{
		title: "Home",
		url: "/portal",
		icon: HomeIcon,
	},
	{
		title: "About",
		url: "/portal/about",
		icon: InfoIcon,
	},
	{
		title: "Profile",
		url: "/portal/profile",
		icon: UserIcon,
	},
	{
		title: "Features",
		url: "#",
		icon: FunctionSquare,
		items: [
			{ title: "Email", url: "/portal/email", icon: MailIcon },
			{ title: "Storage", url: "/portal/storage", icon: HardDriveIcon },
			{ title: "Users", url: "/portal/users", icon: UsersIcon },
		],
	},
	{
		title: "Design System",
		url: "#",
		icon: PaletteIcon,
		items: [
			{ title: "Colors", url: "/portal/colors", icon: PaletteIcon },
			{ title: "Typography", url: "/portal/typography", icon: TextIcon },
			{ title: "Components", url: "/portal/components", icon: PanelLeftIcon },
		],
	},
];

function PortalContent({ children }: { children: React.ReactNode }) {
	const { isPermanentlyExpanded } = useSidebarControl();
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const { user } = useAuth();

	const sidebarEffectivelyOpen = sidebarOpen || isPermanentlyExpanded;
	const contentOffset = sidebarEffectivelyOpen ? "ml-60" : "ml-14";

	const visibleNav = useMemo(
		() => filterNavItemsByRole(navigationItems, user?.role),
		[user?.role],
	);

	return (
		<>
			<AppSidebar
				navigationItems={visibleNav}
				isOpen={sidebarOpen}
				onOpenChange={setSidebarOpen}
			/>
			<div
				className={`flex min-h-screen flex-col transition-all duration-200 ${contentOffset}`}
			>
				<AppHeader />
				<main className="flex-1">{children}</main>
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
				<PortalRoleGuard>{children}</PortalRoleGuard>
			</SidebarControlProvider>
		</AuthProvider>
	);
}
