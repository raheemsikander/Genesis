"use client";

import { useAuth } from "@clerk/nextjs";
import { Spinner } from "@genesis/ui/components/spinner";
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
import { redirect } from "next/navigation";
import { useState } from "react";
import { AppHeader } from "../../components/app-header";
import { AppSidebar, type NavigationItem } from "../../components/app-sidebar";
import {
	SidebarControlProvider,
	useSidebarControl,
} from "../../providers/sidebar-control-provider";

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

	const sidebarEffectivelyOpen = sidebarOpen || isPermanentlyExpanded;
	const contentOffset = sidebarEffectivelyOpen ? "ml-60" : "ml-14";

	return (
		<>
			<AppSidebar
				navigationItems={navigationItems}
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

export default function PortalLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { isSignedIn, isLoaded } = useAuth();

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
		<SidebarControlProvider>
			<PortalContent>{children}</PortalContent>
		</SidebarControlProvider>
	);
}
