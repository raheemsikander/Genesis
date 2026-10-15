import type { UserRole } from "@repo/shared";

export interface RouteAccessConfig {
	/** Roles allowed on this route. Absent => any authenticated user. */
	allowedRoles?: UserRole[];
}

/**
 * Routes inside /portal/* default to "any authenticated user". List a route
 * here only when it should be restricted to specific roles. Dynamic segments
 * use `:paramName` syntax (e.g. /portal/users/:id).
 */
export const routeAccessConfig: Record<string, RouteAccessConfig> = {};

function stripQueryAndHash(pathname: string): string {
	return pathname.split(/[?#]/)[0] ?? pathname;
}

function stripTrailingSlash(pathname: string): string {
	return pathname.length > 1 && pathname.endsWith("/")
		? pathname.slice(0, -1)
		: pathname;
}

/**
 * Match a single route pattern against a pathname.
 *
 * - Same-segment match: each pattern segment matches the path segment, with
 *   `:param` segments treated as wildcards.
 * - Prefix match: a pattern with N segments matches a longer path of N+ segments
 *   when each pattern segment matches the corresponding leading path segment.
 *
 * Prefix matching means `/portal/admin` matches `/portal/admin/users/42`,
 * which closes the silent-fail-open hole where forgetting to enumerate every
 * sub-path would default-allow children of a configured-restricted parent.
 */
function matchRoute(pathname: string, pattern: string): boolean {
	if (pathname === pattern) return true;
	const pathSegments = pathname.split("/").filter(Boolean);
	const patternSegments = pattern.split("/").filter(Boolean);
	if (patternSegments.length > pathSegments.length) return false;
	for (let i = 0; i < patternSegments.length; i++) {
		const p = patternSegments[i];
		const s = pathSegments[i];
		if (p === undefined || s === undefined) return false;
		if (p.startsWith(":")) continue; // dynamic segment matches anything
		if (p !== s) return false;
	}
	return true;
}

/**
 * Find the most specific config key matching `pathname`. Exact matches win
 * over prefix matches; among prefix matches, longer (more segments) wins.
 */
export function findMatchingRoute(pathname: string): string | undefined {
	const clean = stripTrailingSlash(stripQueryAndHash(pathname));

	// Exact match first.
	if (routeAccessConfig[clean]) return clean;

	const keys = Object.keys(routeAccessConfig).sort((a, b) => {
		const aSeg = a.split("/").filter(Boolean).length;
		const bSeg = b.split("/").filter(Boolean).length;
		return bSeg - aSeg;
	});
	for (const key of keys) {
		if (matchRoute(clean, key)) return key;
	}
	return undefined;
}

/**
 * Returns true when:
 *   - the route isn't in the config (default-allow), OR
 *   - the route is in the config but `allowedRoles` is absent (default-allow), OR
 *   - the user's role is in the route's `allowedRoles` list.
 *
 * Returns false when the route is configured with allowedRoles and the user's
 * role isn't in it (or the user has no role).
 */
export function isUserAuthorizedForRoute(
	pathname: string,
	userRole: UserRole | null | undefined,
): boolean {
	const matched = findMatchingRoute(pathname);
	if (!matched) return true;
	const allowed = routeAccessConfig[matched]?.allowedRoles;
	if (!allowed) return true;
	return (
		userRole !== null && userRole !== undefined && allowed.includes(userRole)
	);
}
