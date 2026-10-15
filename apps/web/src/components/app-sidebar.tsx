"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";
import { cn } from "@repo/ui/lib/utils";
import {
	ChevronDown,
	ChevronsUpDown,
	ChevronUp,
	LogOut,
	type LucideIcon,
	UserIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { type FC, useEffect, useState } from "react";
import { useSidebarControl } from "../providers/sidebar-control-provider";
import { AnalyticsEvent, analytics } from "../utils/analytics";
import { ThemePicker } from "./theme-picker";
import { UserAvatar } from "./user-avatar";

// ─── types ────────────────────────────────────────────────────────────────────

export interface NavigationItem {
	title: string;
	url: Route;
	icon?: LucideIcon;
	items?: NavigationItem[];
}

interface AppSidebarProps {
	navigationItems: NavigationItem[];
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

// ─── sidebar ──────────────────────────────────────────────────────────────────

export const AppSidebar: FC<AppSidebarProps> = ({
	navigationItems,
	isOpen,
	onOpenChange,
}) => {
	const { signOut } = useClerk();
	const { user } = useUser();
	const { isPermanentlyExpanded, closeOnNavigate } = useSidebarControl();
	const isMobile = useIsMobile();
	const [expandedParent, setExpandedParent] = useState<string | null>(null);
	const pathname = usePathname();

	const isActive = (url: string) => pathname === url;
	const toggleParent = (title: string) =>
		setExpandedParent((prev) => (prev === title ? null : title));

	useEffect(() => {
		for (const item of navigationItems) {
			if (item.items?.some((child) => child.url === pathname)) {
				setExpandedParent(item.title);
				return;
			}
		}
	}, [pathname, navigationItems]);

	const expanded = isOpen || isPermanentlyExpanded;
	const showFull = isMobile ? true : expanded;
	const hoverHandlersEnabled = !isMobile && !isPermanentlyExpanded;
	const dialogAttrs: React.HTMLAttributes<HTMLElement> =
		isMobile === true
			? {
					role: "dialog",
					"aria-modal": expanded ? true : undefined,
					"aria-label": "Navigation",
					"aria-hidden": expanded ? undefined : true,
				}
			: {};

	const displayName =
		user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "User";
	const email = user?.primaryEmailAddress?.emailAddress;

	return (
		<aside
			{...dialogAttrs}
			className={cn(
				"fixed top-0 left-0 z-50 flex h-screen flex-col border-sidebar-border border-r",
				"bg-sidebar backdrop-blur-md transition-[width,transform] duration-200",
				isMobile
					? cn(
							"w-60 shadow-lg",
							expanded ? "translate-x-0" : "-translate-x-full",
						)
					: cn("translate-x-0", showFull ? "w-60" : "w-14"),
			)}
			onMouseEnter={hoverHandlersEnabled ? () => onOpenChange(true) : undefined}
			onMouseLeave={
				hoverHandlersEnabled ? () => onOpenChange(false) : undefined
			}
		>
			{/* Logo */}
			<div
				className={cn(
					"flex h-16 shrink-0 items-center border-sidebar-border border-b",
					showFull ? "px-4" : "justify-center px-2",
				)}
			>
				<span
					className={cn(
						"font-bold text-foreground tracking-tight",
						showFull ? "text-lg" : "text-lg",
					)}
				>
					{showFull ? "Genesis" : "G"}
				</span>
			</div>

			{/* Navigation */}
			<nav className="flex-1 overflow-y-auto py-2">
				<ul className="space-y-0.5">
					{navigationItems.map((item) =>
						item.items && item.items.length > 0 ? (
							<li key={item.title}>
								<button
									type="button"
									onClick={() => toggleParent(item.title)}
									title={!showFull ? item.title : undefined}
									className={cn(
										"flex w-full cursor-pointer items-center border-transparent border-l-4 py-3 text-sm",
										"text-muted-foreground transition hover:bg-accent hover:text-foreground",
										showFull ? "justify-between px-4" : "justify-center px-2",
									)}
								>
									<div className="flex items-center gap-3">
										{item.icon && <item.icon className="h-4 w-4 shrink-0" />}
										{showFull && <span>{item.title}</span>}
									</div>
									{showFull &&
										(expandedParent === item.title ? (
											<ChevronUp className="h-3.5 w-3.5" />
										) : (
											<ChevronDown className="h-3.5 w-3.5" />
										))}
								</button>

								{expandedParent === item.title && showFull && (
									<ul className="space-y-0.5 pb-1">
										{item.items.map((sub) => (
											<li key={sub.title}>
												<Link
													href={sub.url}
													onClick={closeOnNavigate}
													className={cn(
														"flex items-center gap-3 border-l-4 py-2.5 pr-4 pl-10 text-sm transition",
														"hover:bg-accent hover:text-foreground",
														isActive(sub.url)
															? "border-primary bg-accent font-medium text-foreground"
															: "border-transparent text-muted-foreground",
													)}
												>
													{sub.icon && (
														<sub.icon className="h-4 w-4 shrink-0" />
													)}
													{sub.title}
												</Link>
											</li>
										))}
									</ul>
								)}
							</li>
						) : (
							<li key={item.title}>
								<Link
									href={item.url}
									onClick={closeOnNavigate}
									title={!showFull ? item.title : undefined}
									className={cn(
										"flex items-center border-l-4 py-3 text-sm transition",
										"hover:bg-accent hover:text-foreground",
										showFull ? "gap-3 px-4" : "justify-center px-2",
										isActive(item.url)
											? "border-primary bg-accent font-medium text-foreground"
											: "border-transparent text-muted-foreground",
									)}
								>
									{item.icon && <item.icon className="h-4 w-4 shrink-0" />}
									{showFull && item.title}
								</Link>
							</li>
						),
					)}
				</ul>
			</nav>

			{/* Footer — user dropdown */}
			<div className="shrink-0 border-sidebar-border border-t p-2">
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<button
								type="button"
								className={cn(
									"flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition",
									"hover:bg-accent",
									!showFull && "justify-center",
								)}
							/>
						}
					>
						<UserAvatar user={user} size="sm" />
						{showFull && (
							<>
								<span className="mp-mask flex-1 truncate text-left font-medium text-foreground text-xs">
									{displayName}
								</span>
								<ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
							</>
						)}
					</DropdownMenuTrigger>

					<DropdownMenuContent
						side={isMobile ? "top" : "right"}
						align={isMobile ? "start" : "end"}
					>
						{/* User info */}
						<div className="px-2 py-2">
							<div className="flex items-center gap-3">
								<UserAvatar user={user} />
								<div className="min-w-0">
									<p className="mp-mask truncate font-semibold text-foreground text-sm">
										{displayName}
									</p>
									{email && (
										<p className="mp-mask truncate text-muted-foreground text-xs">
											{email}
										</p>
									)}
								</div>
							</div>
						</div>

						<DropdownMenuSeparator />

						<DropdownMenuItem>
							<Link
								href={{ pathname: "/portal/profile" }}
								onClick={closeOnNavigate}
								className="flex items-center gap-2"
							>
								<UserIcon className="h-4 w-4" />
								Profile
							</Link>
						</DropdownMenuItem>

						<DropdownMenuSeparator />

						{/* Theme picker — stop propagation so dropdown stays open */}
						<div onPointerDown={(e) => e.stopPropagation()}>
							<ThemePicker />
						</div>

						<DropdownMenuSeparator />

						<DropdownMenuItem
							variant="destructive"
							onClick={() => {
								analytics.track(AnalyticsEvent.SIGN_OUT, {
									reason: "user_initiated",
								});
								void signOut();
							}}
							className="cursor-pointer"
						>
							<LogOut className="h-4 w-4" />
							Sign out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</aside>
	);
};
