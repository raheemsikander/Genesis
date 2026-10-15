"use client";

import type { UserRole } from "@repo/shared";
import type { ReactNode } from "react";
import { useAuth } from "../hooks/use-auth";

interface AuthorizerProps {
	allowedRoles: UserRole[];
	children: ReactNode;
	fallback?: ReactNode;
}

/**
 * Component-level role gate. Loading → null. Authorized → children.
 * Unauthorized (no user, or role not in allowedRoles) → fallback (default null).
 *
 * No redirects — that's the layout's / middleware's job.
 */
export function Authorizer({
	allowedRoles,
	children,
	fallback = null,
}: AuthorizerProps) {
	const { user, isLoading } = useAuth();
	if (isLoading) return null;
	const allowed = user !== null && allowedRoles.includes(user.role);
	return <>{allowed ? children : fallback}</>;
}
