import { ORPCError, os } from "@orpc/server";
import type { UserRole } from "@repo/shared";

/**
 * Returns an oRPC middleware that allows the request through when
 * `context.dbUser.role` is in `allowedRoles`, and throws FORBIDDEN otherwise.
 * Declares `dbUser` as a required context, so it only composes onto
 * `protectedProcedure` (which loads it): `protectedProcedure.use(requireRole(Roles.ADMIN))`.
 */
export function requireRole(...allowedRoles: UserRole[]) {
	return os
		.$context<{ dbUser: { role: UserRole } }>()
		.middleware(async ({ context, next }) => {
			if (!allowedRoles.includes(context.dbUser.role)) {
				throw new ORPCError("FORBIDDEN", { message: "Permission denied" });
			}
			return next();
		});
}
