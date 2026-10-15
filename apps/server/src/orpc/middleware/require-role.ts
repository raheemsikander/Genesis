import { ORPCError } from "@orpc/server";
import type { UserRole } from "@repo/shared";

interface RequireRoleContext {
	dbUser: { role: UserRole };
}

interface RequireRoleArgs<TNext> {
	context: RequireRoleContext;
	next: () => Promise<TNext>;
}

/**
 * Returns an oRPC middleware that allows the request through when
 * `context.dbUser.role` is in `allowedRoles`, and throws FORBIDDEN otherwise.
 *
 * Compose with `protectedProcedure.use(requireRole(Roles.ADMIN))`.
 */
export function requireRole(...allowedRoles: UserRole[]) {
	return async <TNext>({ context, next }: RequireRoleArgs<TNext>) => {
		if (!allowedRoles.includes(context.dbUser.role)) {
			throw new ORPCError("FORBIDDEN", {
				message: "Permission denied",
			});
		}
		return next();
	};
}
