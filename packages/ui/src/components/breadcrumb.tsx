"use client";

import { cn } from "@repo/ui/lib/utils";
import { ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import type * as React from "react";
import { Skeleton } from "./skeleton";

/**
 * Shared className for any anchor used inside a breadcrumb trail. Apps that
 * use Next.js's <Link> should apply this to the Link element directly.
 */
export const breadcrumbLinkClasses =
	"inline-flex items-center rounded-sm px-1 py-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
	return (
		<nav
			data-slot="breadcrumb"
			aria-label="Breadcrumb"
			className={cn("text-sm", className)}
			{...props}
		/>
	);
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
	return (
		<ol
			data-slot="breadcrumb-list"
			className={cn(
				"flex flex-wrap items-center gap-1.5 break-words",
				className,
			)}
			{...props}
		/>
	);
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
	return (
		<li
			data-slot="breadcrumb-item"
			className={cn("inline-flex items-center gap-1.5", className)}
			{...props}
		/>
	);
}

function BreadcrumbLink({ className, ...props }: React.ComponentProps<"a">) {
	return (
		<a
			data-slot="breadcrumb-link"
			className={cn(breadcrumbLinkClasses, className)}
			{...props}
		/>
	);
}

function BreadcrumbPage({
	className,
	children,
	title,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="breadcrumb-page"
			aria-current="page"
			title={title}
			className={cn("font-medium text-foreground", className)}
			{...props}
		>
			{children}
		</span>
	);
}

// Renders as an <li> so it's a valid direct child of BreadcrumbList's <ol>.
// role="presentation" + aria-hidden hide it from the a11y tree, since the
// separator is purely visual between adjacent crumb items.
function BreadcrumbSeparator({
	className,
	children,
	...props
}: React.ComponentProps<"li">) {
	return (
		<li
			data-slot="breadcrumb-separator"
			role="presentation"
			aria-hidden="true"
			className={cn(
				"inline-flex shrink-0 text-muted-foreground [&_svg]:size-3.5",
				className,
			)}
			{...props}
		>
			{children ?? <ChevronRightIcon />}
		</li>
	);
}

function BreadcrumbEllipsis({
	className,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="breadcrumb-ellipsis"
			role="presentation"
			aria-hidden="true"
			className={cn(
				"inline-flex h-4 w-4 items-center justify-center text-muted-foreground",
				className,
			)}
			{...props}
		>
			<MoreHorizontalIcon className="size-3.5" />
			<span className="sr-only">More</span>
		</span>
	);
}

function BreadcrumbSkeleton({
	className,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="breadcrumb-skeleton"
			role="status"
			aria-label="Loading"
			className={cn("inline-block align-middle", className)}
			{...props}
		>
			<Skeleton className="h-4 w-20" />
		</span>
	);
}

export {
	Breadcrumb,
	BreadcrumbEllipsis,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
	BreadcrumbSkeleton,
};
