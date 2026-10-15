import type { NavigationItem } from "../components/app-sidebar";
import { navigationItems } from "./navigation-items";

export type StaticLabelMap = Record<string, string>;

export type ResolvedLabel =
	| { kind: "label"; value: string }
	| { kind: "skeleton" };

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function flattenNavItems(items: NavigationItem[]): NavigationItem[] {
	const out: NavigationItem[] = [];
	for (const item of items) {
		out.push(item);
		if (item.items?.length) {
			out.push(...flattenNavItems(item.items));
		}
	}
	return out;
}

function buildStaticLabels(): StaticLabelMap {
	const map: StaticLabelMap = {};
	for (const item of flattenNavItems(navigationItems)) {
		if (item.url && item.url !== "#") {
			map[item.url] = item.title;
		}
	}
	return map;
}

export const staticBreadcrumbLabels: StaticLabelMap = buildStaticLabels();

export function isUuidShape(segment: string): boolean {
	if (!segment) return false;
	return UUID_RE.test(segment);
}

export function titleCaseSegment(segment: string): string {
	if (!segment) return "";
	return segment
		.split("-")
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

// Only UUIDs are recognized as dynamic identifiers worth deferring to an
// override (the page that owns the segment calls useSetBreadcrumbLabel
// once data loads). Other dynamic-segment shapes — numeric IDs, slugs,
// cuid2, nanoid — fall through to titleCaseSegment and render their raw
// value (e.g. "Abc-123"). If you add a route like /portal/orders/[orderId]
// with a non-UUID id, extend isUuidShape (or add a sibling detector) and
// ensure the page sets a label, otherwise the raw id ships into the crumb.
export function resolveLabel(input: {
	segment: string;
	cumulativePath: string;
	overrides: Record<string, string>;
	staticMap: StaticLabelMap;
}): ResolvedLabel {
	const { segment, cumulativePath, overrides, staticMap } = input;

	const override = overrides[cumulativePath];
	if (override !== undefined) {
		return { kind: "label", value: override };
	}

	const staticHit = staticMap[cumulativePath];
	if (staticHit !== undefined) {
		return { kind: "label", value: staticHit };
	}

	if (isUuidShape(segment)) {
		return { kind: "skeleton" };
	}

	return { kind: "label", value: titleCaseSegment(segment) };
}
