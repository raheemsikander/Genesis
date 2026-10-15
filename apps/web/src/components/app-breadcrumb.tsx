"use client";

import {
	Breadcrumb,
	BreadcrumbEllipsis,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
	BreadcrumbSkeleton,
	breadcrumbLinkClasses,
} from "@repo/ui/components/breadcrumb";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, type ReactNode, useMemo } from "react";
import {
	resolveLabel,
	staticBreadcrumbLabels,
} from "../config/breadcrumb-labels";
import { useBreadcrumbLabels } from "../providers/breadcrumb-provider";

type Crumb =
	| { kind: "label"; label: string; href: string; segment: string }
	| { kind: "skeleton"; href: string; segment: string };

function buildCrumbs(
	pathname: string,
	overrides: Record<string, string>,
): Crumb[] {
	const rawSegments = pathname.split("/").filter(Boolean);
	if (rawSegments.length === 0) return [];

	const crumbs: Crumb[] = [];
	let cumulative = "";
	for (const segment of rawSegments) {
		cumulative = `${cumulative}/${segment}`;
		const resolved = resolveLabel({
			segment,
			cumulativePath: cumulative,
			overrides,
			staticMap: staticBreadcrumbLabels,
		});
		if (resolved.kind === "skeleton") {
			crumbs.push({ kind: "skeleton", href: cumulative, segment });
		} else {
			crumbs.push({
				kind: "label",
				label: resolved.value,
				href: cumulative,
				segment,
			});
		}
	}
	return crumbs;
}

function renderCrumbContent(crumb: Crumb, isLast: boolean): ReactNode {
	if (isLast) {
		return crumb.kind === "skeleton" ? (
			<BreadcrumbSkeleton />
		) : (
			<BreadcrumbPage>{crumb.label}</BreadcrumbPage>
		);
	}
	const body = crumb.kind === "skeleton" ? <BreadcrumbSkeleton /> : crumb.label;
	return (
		<Link href={crumb.href as Route} className={breadcrumbLinkClasses}>
			{body}
		</Link>
	);
}

export function AppBreadcrumb() {
	const pathname = usePathname();
	const overrides = useBreadcrumbLabels();

	const crumbs = useMemo(
		() => (pathname ? buildCrumbs(pathname, overrides) : []),
		[pathname, overrides],
	);

	const collapseEllipsis = crumbs.length >= 3;

	return (
		<Breadcrumb>
			<BreadcrumbList>
				{crumbs.map((crumb, index) => {
					const isFirst = index === 0;
					const isLast = index === crumbs.length - 1;
					const isMiddle = !isFirst && !isLast;
					const showEllipsisAtPosition1 = collapseEllipsis && index === 1;

					return (
						<Fragment key={crumb.href}>
							{!isFirst && (
								<BreadcrumbSeparator
									className={
										collapseEllipsis && isMiddle
											? "hidden sm:inline-flex"
											: undefined
									}
								/>
							)}

							{showEllipsisAtPosition1 && (
								<>
									<BreadcrumbItem className="sm:hidden">
										<BreadcrumbEllipsis />
									</BreadcrumbItem>
									<BreadcrumbSeparator className="sm:hidden" />
								</>
							)}

							<BreadcrumbItem
								className={
									collapseEllipsis && isMiddle ? "hidden sm:inline-flex" : ""
								}
							>
								{renderCrumbContent(crumb, isLast)}
							</BreadcrumbItem>
						</Fragment>
					);
				})}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
