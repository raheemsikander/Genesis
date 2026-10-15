import type { UserRole } from "@repo/shared";
import { isUserAuthorizedForRoute } from "../../../config/route-access";

interface NavItemLike {
	url: string;
	items?: NavItemLike[];
}

/**
 * Returns a filtered copy of `items` where every entry (and recursively each
 * nested entry's `items[]`) passes `isUserAuthorizedForRoute(item.url, role)`.
 *
 * Group headers (URL `"#"`) are kept only if at least one descendant is
 * visible after recursion — otherwise they're dropped to avoid empty groups.
 */
export function filterNavItemsByRole<T extends NavItemLike>(
	items: T[],
	role: UserRole | null | undefined,
): T[] {
	const result: T[] = [];
	for (const item of items) {
		const filteredChildren = item.items
			? filterNavItemsByRole(item.items, role)
			: undefined;

		const isGroupHeader = item.url === "#";

		if (isGroupHeader) {
			if (filteredChildren && filteredChildren.length > 0) {
				result.push({ ...item, items: filteredChildren });
			}
			continue;
		}

		if (!isUserAuthorizedForRoute(item.url, role)) continue;
		result.push({
			...item,
			...(filteredChildren ? { items: filteredChildren } : {}),
		});
	}
	return result;
}
