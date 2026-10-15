import type { ReactNode } from "react";

import { AppBreadcrumb } from "./app-breadcrumb";

interface BaseLayoutProps {
	title: ReactNode;
	description?: string;
	/** Whether to render the breadcrumb trail. Defaults to true. */
	showBreadcrumb?: boolean;
	children: ReactNode;
}

export function BaseLayout({
	title,
	description,
	showBreadcrumb = true,
	children,
}: BaseLayoutProps) {
	return (
		<div className="min-h-screen bg-background p-6">
			{showBreadcrumb && (
				<div className="mb-4">
					<AppBreadcrumb />
				</div>
			)}
			<div className="rounded-md border border-border bg-card px-6 py-4">
				<h1 className="font-semibold text-foreground text-xl">{title}</h1>
				{description && (
					<p className="mt-1 text-muted-foreground text-sm">{description}</p>
				)}
			</div>
			<div className="mt-6">{children}</div>
		</div>
	);
}
