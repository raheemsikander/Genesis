"use client";

import { Menu } from "lucide-react";
import { useSidebarControl } from "../providers/sidebar-control-provider";

export function AppHeader() {
	const { handleManualToggle } = useSidebarControl();

	return (
		<header className="sticky top-0 z-30 flex h-16 w-full shrink-0 items-center border-border border-b bg-sidebar px-6 backdrop-blur-md">
			<button
				type="button"
				onClick={handleManualToggle}
				className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
				aria-label="Toggle sidebar"
			>
				<Menu className="h-5 w-5" />
			</button>
		</header>
	);
}
